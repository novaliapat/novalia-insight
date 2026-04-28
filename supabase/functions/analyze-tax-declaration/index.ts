// Edge function: analyze-tax-declaration
//
// ARCHITECTURE RAG PAR CATÉGORIE (à implémenter en V2) :
// Pour chaque catégorie présente dans validatedData.detectedCategories,
// faire une recherche RAG INDÉPENDANTE dans la bibliothèque correspondante :
//   - ifu          -> rag_library_ifu
//   - scpi         -> rag_library_scpi
//   - life_insurance -> rag_library_life_insurance
//   ...
// Puis agréger les résultats SANS mélanger les sources.
// Chaque case fiscale produite doit conserver :
//   - sa catégorie d'origine
//   - ses sources RAG (toujours liées à sa catégorie)
//   - son niveau de confiance
//   - un flag requiresManualReview = true si aucune source pertinente
//
// V1 : retourne une analyse mockée.

import { corsHeaders } from "npm:@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // V2 — pseudo-code RAG par catégorie :
    //
    // const { validatedData } = await req.json();
    // const results = await Promise.all(
    //   validatedData.detectedCategories.map(async (cat) => {
    //     const sources = await searchRagLibrary(cat, buildQueryFor(cat, validatedData));
    //     return { category: cat, sources };
    //   })
    // );
    // const analysis = await callLovableAI({ validatedData, ragByCategory: results });

    const mock = {
      summary: "Analyse mockée — branchement RAG à venir.",
      taxYear: 2024,
      analyzedCategories: [],
      taxForms: [],
      taxCases: [],
      amountsByCategory: [],
      warnings: [],
      uncertaintyPoints: [],
      requiredDocuments: [],
      finalChecklist: [],
    };

    return new Response(JSON.stringify(mock), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-tax-declaration error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
