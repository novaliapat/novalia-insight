import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  computeReviewStatusFromItems,
  type DeclarationReviewStatus,
  type ReviewItemStatus,
} from "../_shared/review/computeReviewStatus.ts";

const RequestSchema = z.object({
  reviewItemId: z.string().uuid(),
  action: z.enum(["resolve", "ignore", "reopen", "update_note"]),
  note: z.string().max(2000).nullable().optional(),
});

const ACTION_TO_STATUS: Record<"resolve" | "ignore" | "reopen", ReviewItemStatus> = {
  resolve: "resolved",
  ignore: "ignored",
  reopen: "pending",
};

const ACTION_TO_AUDIT: Record<string, string> = {
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

async function recomputeReviewStatus(
  admin: ReturnType<typeof createClient>,
  declarationId: string,
): Promise<DeclarationReviewStatus> {
  const { data, error } = await admin
    .from("declaration_review_items")
    .select("status")
    .eq("declaration_id", declarationId);
  if (error) throw new Error(`load items failed: ${error.message}`);
  const statuses = (data ?? []).map((r) => r.status as ReviewItemStatus);
  const reviewStatus = computeReviewStatusFromItems(statuses);
  const { error: upErr } = await admin
    .from("declarations")
    .update({ review_status: reviewStatus })
    .eq("id", declarationId);
  if (upErr) throw new Error(`update review_status failed: ${upErr.message}`);
  return reviewStatus;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonError(401, "Unauthorized");
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "Paramètres invalides", parsed.error.flatten());
    }
    const { reviewItemId, action, note } = parsed.data;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Charger l'item
    const { data: item, error: itemErr } = await admin
      .from("declaration_review_items")
      .select("id, declaration_id, status, source_type, source_code, field, note")
      .eq("id", reviewItemId)
      .maybeSingle();
    if (itemErr) return jsonError(500, "Lecture du point de revue échouée", itemErr.message);
    if (!item) return jsonError(404, "Point de revue introuvable");

    // 2) Vérification ownership via la déclaration
    const { data: decl, error: declErr } = await admin
      .from("declarations")
      .select("id, user_id")
      .eq("id", item.declaration_id)
      .maybeSingle();
    if (declErr || !decl) return jsonError(404, "Déclaration introuvable");
    if (decl.user_id !== userId) return jsonError(403, "Accès refusé");

    const previousStatus = item.status as ReviewItemStatus;
    let newStatus: ReviewItemStatus = previousStatus;
    let newNote: string | null = item.note ?? null;

    // 3) Application de l'action
    if (action === "update_note") {
      newNote = note ?? null;
      const { error: upErr } = await admin
        .from("declaration_review_items")
        .update({ note: newNote })
        .eq("id", item.id);
      if (upErr) return jsonError(500, "Mise à jour de la note échouée", upErr.message);
    } else {
      newStatus = ACTION_TO_STATUS[action];
      const { error: upErr } = await admin
        .from("declaration_review_items")
        .update({ status: newStatus })
        .eq("id", item.id);
      if (upErr) return jsonError(500, "Mise à jour du statut échouée", upErr.message);
    }

    // 4) Audit log
    const auditAction = ACTION_TO_AUDIT[action];
    const updatedAt = new Date().toISOString();
    await admin.from("declaration_audit_logs").insert({
      declaration_id: item.declaration_id,
      user_id: userId,
      action: auditAction,
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

    // 5) Recalcul du review_status de la déclaration
    const reviewStatus = await recomputeReviewStatus(admin, item.declaration_id);

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
});
