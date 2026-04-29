import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  computeReviewStatusFromItems,
  type DeclarationReviewStatus,
  type ReviewItemStatus,
} from "../_shared/review/computeReviewStatus.ts";

// ---------------------------------------------------------------------------
// Schémas + constantes
// ---------------------------------------------------------------------------

export const RequestSchema = z.object({
  reviewItemId: z.string().uuid(),
  action: z.enum(["resolve", "ignore", "reopen", "update_note"]),
  note: z.string().max(2000).nullable().optional(),
});
export type UpdateReviewItemRequest = z.infer<typeof RequestSchema>;

const ACTION_TO_STATUS: Record<"resolve" | "ignore" | "reopen", ReviewItemStatus> = {
  resolve: "resolved",
  ignore: "ignored",
  reopen: "pending",
};

const ACTION_TO_AUDIT: Record<UpdateReviewItemRequest["action"], string> = {
  resolve: "review_item_resolved",
  ignore: "review_item_ignored",
  reopen: "review_item_reopened",
  update_note: "review_item_note_updated",
};

function jsonError(status: number, error: string, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Dépendances injectables (pour la testabilité)
// ---------------------------------------------------------------------------

export interface ReviewItemRecord {
  id: string;
  declaration_id: string;
  status: ReviewItemStatus;
  source_type: string | null;
  source_code: string | null;
  field: string | null;
  note: string | null;
}

export interface AuditLogPayload {
  declaration_id: string;
  user_id: string;
  action: string;
  metadata: {
    review_item_id: string;
    declaration_id: string;
    previous_status: ReviewItemStatus;
    new_status: ReviewItemStatus;
    source_type: string | null;
    source_code: string | null;
    field: string | null;
    has_note: boolean;
    updated_at: string;
  };
}

export interface ReviewStore {
  /** Renvoie l'item ou null s'il n'existe pas. */
  loadItem(reviewItemId: string): Promise<ReviewItemRecord | null>;
  /** Renvoie { user_id } de la déclaration ou null si introuvable. */
  loadDeclarationOwner(declarationId: string): Promise<{ user_id: string } | null>;
  updateItemStatus(reviewItemId: string, status: ReviewItemStatus): Promise<void>;
  updateItemNote(reviewItemId: string, note: string | null): Promise<void>;
  insertAuditLog(payload: AuditLogPayload): Promise<void>;
  /** Liste les statuts de tous les items d'une déclaration (pour le recalcul). */
  listItemStatuses(declarationId: string): Promise<ReviewItemStatus[]>;
  updateDeclarationReviewStatus(
    declarationId: string,
    reviewStatus: DeclarationReviewStatus,
  ): Promise<void>;
}

export interface AuthResolver {
  /** Renvoie l'userId si le token est valide, sinon null. */
  resolveUserId(authHeader: string): Promise<string | null>;
}

export interface HandlerDeps {
  store: ReviewStore;
  auth: AuthResolver;
  /** Permet d'injecter une horloge déterministe en test. */
  now?: () => Date;
}

// ---------------------------------------------------------------------------
// Logique pure : recalcul + sauvegarde du review_status
// ---------------------------------------------------------------------------

export async function recomputeAndSaveReviewStatus(
  store: ReviewStore,
  declarationId: string,
): Promise<DeclarationReviewStatus> {
  const statuses = await store.listItemStatuses(declarationId);
  const reviewStatus = computeReviewStatusFromItems(statuses);
  await store.updateDeclarationReviewStatus(declarationId, reviewStatus);
  return reviewStatus;
}

// ---------------------------------------------------------------------------
// Handler testable
// ---------------------------------------------------------------------------

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Unauthorized");

    const userId = await deps.auth.resolveUserId(authHeader);
    if (!userId) return jsonError(401, "Unauthorized");

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "Paramètres invalides", parsed.error.flatten());
    }
    const { reviewItemId, action, note } = parsed.data;

    // 1) Charger l'item — JAMAIS depuis le body
    const item = await deps.store.loadItem(reviewItemId);
    if (!item) return jsonError(404, "Point de revue introuvable");

    // 2) Ownership via la déclaration — JAMAIS depuis le body
    const owner = await deps.store.loadDeclarationOwner(item.declaration_id);
    if (!owner) return jsonError(404, "Déclaration introuvable");
    if (owner.user_id !== userId) return jsonError(403, "Accès refusé");

    const previousStatus = item.status;
    let newStatus: ReviewItemStatus = previousStatus;
    let newNote: string | null = item.note;

    // 3) Application de l'action
    if (action === "update_note") {
      // note vide / undefined → null (normalisation)
      const trimmed = typeof note === "string" ? note : null;
      newNote = trimmed && trimmed.trim().length > 0 ? trimmed : null;
      await deps.store.updateItemNote(item.id, newNote);
    } else {
      newStatus = ACTION_TO_STATUS[action];
      await deps.store.updateItemStatus(item.id, newStatus);
    }

    // 4) Audit log enrichi
    const updatedAt = (deps.now ? deps.now() : new Date()).toISOString();
    await deps.store.insertAuditLog({
      declaration_id: item.declaration_id,
      user_id: userId,
      action: ACTION_TO_AUDIT[action],
      metadata: {
        review_item_id: item.id,
        declaration_id: item.declaration_id,
        previous_status: previousStatus,
        new_status: newStatus,
        source_type: item.source_type,
        source_code: item.source_code,
        field: item.field,
        has_note: Boolean(newNote && newNote.trim().length > 0),
        updated_at: updatedAt,
      },
    });

    // 5) Recalcul du review_status
    const reviewStatus = await recomputeAndSaveReviewStatus(deps.store, item.declaration_id);

    return new Response(
      JSON.stringify({
        ok: true,
        reviewItem: {
          id: item.id,
          declaration_id: item.declaration_id,
          status: newStatus,
          note: newNote,
        },
        declarationReviewStatus: reviewStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("update-review-item error:", e);
    return jsonError(500, e instanceof Error ? e.message : "Erreur inconnue");
  }
}

// ---------------------------------------------------------------------------
// Wiring production : Supabase client réel
// ---------------------------------------------------------------------------

function createSupabaseDeps(): HandlerDeps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const store: ReviewStore = {
    async loadItem(id) {
      const { data, error } = await admin
        .from("declaration_review_items")
        .select("id, declaration_id, status, source_type, source_code, field, note")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`load item failed: ${error.message}`);
      return (data as ReviewItemRecord | null) ?? null;
    },
    async loadDeclarationOwner(declarationId) {
      const { data, error } = await admin
        .from("declarations")
        .select("user_id")
        .eq("id", declarationId)
        .maybeSingle();
      if (error) throw new Error(`load decl failed: ${error.message}`);
      return (data as { user_id: string } | null) ?? null;
    },
    async updateItemStatus(id, status) {
      const { error } = await admin
        .from("declaration_review_items")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(`update status failed: ${error.message}`);
    },
    async updateItemNote(id, note) {
      const { error } = await admin
        .from("declaration_review_items")
        .update({ note })
        .eq("id", id);
      if (error) throw new Error(`update note failed: ${error.message}`);
    },
    async insertAuditLog(payload) {
      const { error } = await admin.from("declaration_audit_logs").insert(payload);
      if (error) throw new Error(`audit insert failed: ${error.message}`);
    },
    async listItemStatuses(declarationId) {
      const { data, error } = await admin
        .from("declaration_review_items")
        .select("status")
        .eq("declaration_id", declarationId);
      if (error) throw new Error(`list statuses failed: ${error.message}`);
      return ((data ?? []) as Array<{ status: ReviewItemStatus }>).map((r) => r.status);
    },
    async updateDeclarationReviewStatus(declarationId, reviewStatus) {
      const { error } = await admin
        .from("declarations")
        .update({ review_status: reviewStatus })
        .eq("id", declarationId);
      if (error) throw new Error(`update review_status failed: ${error.message}`);
    },
  };

  const auth: AuthResolver = {
    async resolveUserId(authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getClaims(token);
      if (error || !data?.claims) return null;
      return data.claims.sub as string;
    },
  };

  return { store, auth };
}

Deno.serve((req) => handleRequest(req, createSupabaseDeps()));
