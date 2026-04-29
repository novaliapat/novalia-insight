# Contrat d'extraction — `extract-tax-data`

> Source de vérité Zod : `src/lib/declaration/contracts/`
> Miroir Deno (edge) : `supabase/functions/_shared/contracts/extractionContracts.ts`
> Test de parité : `src/lib/declaration/contracts/contractsParity.test.ts`

## Rôle de l'extraction

Le module `extract-tax-data` est un **moteur d'extraction**. Il identifie et
structure les données présentes dans les documents fournis. Il ne fait **rien
d'autre**. L'analyse fiscale (cases, formulaires, mécanismes, recommandations)
appartient à un module ultérieur.

## Ce que l'extraction a le droit de produire

- Les champs typés du schéma `ExtractedDataSchema` (taxpayer, taxYear,
  detectedCategories, ifu, scpi, lifeInsurance, warnings, missingData,
  globalConfidence).
- Pour chaque montant : un objet `{ value:number, confidence, sourceDocument, note? }`.
- Des `warnings` et `missingData` documentaires.

## Ce que l'extraction n'a PAS le droit de produire

- Aucune case fiscale (`2DC`, `2TR`, `4BA`…), aucun formulaire (`2042`, `2044`…).
- Aucune recommandation, aucun jugement de conformité.
- Aucune transformation fiscale : pas de base imposable, pas d'abattement,
  pas de PFU calculé, pas de prorata, pas de mécanisme de convention fiscale.
- Aucune métadonnée système (version de prompt, timestamp, modèle) :
  ces métadonnées sont injectées **uniquement par l'edge function**.

Tout champ inattendu retourné par l'IA est silencieusement supprimé par Zod
(mode `.strip()` par défaut), donc rien ne fuit en base.

## Format officiel de réponse

L'edge function valide sa propre réponse via `ExtractTaxDataResponseSchema`
avant de l'envoyer.

```ts
{
  data:     ExtractedData,        // sortie IA validée (données fiscales pures)
  metadata: ExtractionMetadata,   // injectée serveur : prompt version, extractedAt, model, dryRun
  audit:    ExtractionAudit,      // calculé serveur : counts, statut, issues
  status:   ExtractionStatus      // dérivé serveur (règle officielle)
}
```

## Séparation des responsabilités

| Couche             | Responsabilité                                                                 |
|--------------------|--------------------------------------------------------------------------------|
| IA (Lovable AI)    | Renvoyer **uniquement** les champs de `ExtractedData` via le tool call.        |
| Edge function      | Valider Zod, injecter `metadata`, calculer `audit` et `status`, persister.     |
| Front              | Afficher la réponse validée. Aucun recalcul de la source de vérité.            |

## Exemple JSON valide

```json
{
  "data": {
    "taxpayer": { "fullName": "Jean Dupont" },
    "taxYear": 2024,
    "detectedCategories": ["ifu"],
    "ifu": [{
      "institution": "BNP Paribas",
      "dividends":      { "value": 1234.56, "confidence": "high", "sourceDocument": "ifu_2024.pdf" },
      "withholdingTax": { "value": 370.37,  "confidence": "high", "sourceDocument": "ifu_2024.pdf" }
    }],
    "scpi": [], "lifeInsurance": [],
    "warnings": [], "missingData": [],
    "globalConfidence": "high"
  },
  "metadata": {
    "extractionPromptVersion": "v1.0.0",
    "extractedAt": "2026-04-29T10:00:00.000Z",
    "modelUsed": "google/gemini-2.5-pro",
    "dryRun": false
  },
  "audit": {
    "declarationId": "…",
    "extractedAt": "2026-04-29T10:00:00.000Z",
    "extractionPromptVersion": "v1.0.0",
    "modelUsed": "google/gemini-2.5-pro",
    "dryRun": false,
    "detectedCategories": ["ifu"],
    "globalConfidence": "high",
    "status": "extraction_completed",
    "numberOfFiles": 1,
    "numberOfExtractedFields": 2,
    "numberOfWarnings": 0,
    "numberOfMissingData": 0,
    "numberOfConsistencyIssues": 0,
    "consistencyIssues": [],
    "warnings": [],
    "missingData": []
  },
  "status": "extraction_completed"
}
```

## Exemple JSON invalide (rejeté par le contrat)

```json
{
  "data": {
    "taxpayer": { "fullName": "Jean" },
    "taxYear": 2024,
    "detectedCategories": ["assurance-vie"],   // ❌ doit être "life_insurance"
    "ifu": [{
      "institution": "BNP",
      "dividends": { "value": "1234,56", "confidence": "high" }  // ❌ value doit être number
    }],
    "form": "2042",                            // ❌ champ interdit (analyse fiscale)
    "box": "2DC"                                // ❌ champ interdit
  },
  "status": "extraction_unknown"               // ❌ statut hors enum
}
```

## Maintenir la parité front/edge

1. Modifier `src/lib/declaration/contracts/`.
2. Répliquer dans `supabase/functions/_shared/contracts/extractionContracts.ts`.
3. Lancer `contractsParity.test.ts` — il échoue si les enums divergent.
