import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const RequestSchema = z.object({
  declarationId: z.string().uuid(),
  context: z.enum(["before_analysis", "before_finalization"]).optional(),
});

function jsonError(status: number, error: string, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonError(401, "Unauthorized");
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "Paramètres invalides", parsed.error.flatten());
    }
    const { declarationId, context } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Vérifier ownership
    const { data: decl, error: declErr } = await admin
      .from("declarations")
      .select("id, user_id, review_status")
      .eq("id", declarationId)
      .maybeSingle();
    if (declErr) return jsonError(500, declErr.message);
    if (!decl) return jsonError(404, "Déclaration introuvable");
    if (decl.user_id !== userId) return jsonError(403, "Accès refusé");

    // Recalculer compteurs côté backend
    const { data: items, error: itemsErr } = await admin
      .from("declaration_review_items")
      .select("status, severity")
      .eq("declaration_id", declarationId);
    if (itemsErr) return jsonError(500, itemsErr.message);

    const counts = (items ?? []).reduce(
      (acc, it: { status: string; severity: string }) => {
        if (it.status === "pending") {
          acc.pending_count += 1;
          if (it.severity === "error") acc.pending_error_count += 1;
          else if (it.severity === "warning") acc.pending_warning_count += 1;
        } else if (it.status === "ignored") {
          acc.ignored_count += 1;
        }
        return acc;
      },
      { pending_count: 0, pending_warning_count: 0, pending_error_count: 0, ignored_count: 0 },
    );

    // Récupérer extraction_status pour audit complet
    const { data: ext } = await admin
      .from("declaration_extracted_data")
      .select("extraction_status")
      .eq("declaration_id", declarationId)
      .maybeSingle();

    const confirmedAt = new Date().toISOString();

    const { error: auditErr } = await admin.from("declaration_audit_logs").insert({
      declaration_id: declarationId,
      user_id: userId,
      action: "review_override_confirmed",
      metadata: {
        declaration_id: declarationId,
        review_status: decl.review_status,
        extraction_status: ext?.extraction_status ?? null,
        context: context ?? null,
        ...counts,
        confirmed_at: confirmedAt,
      },
    });
    if (auditErr) return jsonError(500, auditErr.message);

    return new Response(
      JSON.stringify({ ok: true, confirmedAt, counts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("confirm-review-override error:", e);
    return jsonError(500, e instanceof Error ? e.message : "Erreur inconnue");
  }
});
