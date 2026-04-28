// Edge function: extract-tax-data
// Rôle : extraire les données fiscales des documents importés.
// V1 : retourne des données mockées. V2 branchera Lovable AI multimodal.

import { corsHeaders } from "npm:@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // V2 : récupérer les fichiers depuis storage et appeler Lovable AI
    // const { fileIds, declarationId } = await req.json();

    // --- MOCK ---
    const mock = {
      taxpayer: { fullName: "Mock", taxHousehold: "Marié, 2 parts" },
      taxYear: 2024,
      detectedCategories: ["ifu", "scpi"],
      ifu: [],
      scpi: [],
      lifeInsurance: [],
      warnings: [],
      missingData: [],
      globalConfidence: "medium",
    };

    return new Response(JSON.stringify(mock), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-tax-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
