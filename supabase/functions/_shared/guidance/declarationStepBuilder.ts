// Construit les étapes du parcours déclaratif (type impots.gouv) à partir
// des formulaires requis et des propositions de cases. Aucune invention.
import type {
  DeclarationStep,
  RequiredForm,
  TaxBoxProposal,
} from "./guidanceSchemas.ts";

export interface BuildStepsInput {
  requiredForms: RequiredForm[];
  proposals: TaxBoxProposal[];
}

// Ordre déclaratif logique : annexes d'abord (2044, 2047), principal ensuite.
const FORM_ORDER: Record<string, number> = {
  "2044": 1,
  "2047": 2,
  "2042-RICI": 3,
  "2042C": 4,
  "2042": 5,
  "other": 9,
};

export function buildDeclarationSteps(input: BuildStepsInput): DeclarationStep[] {
  const formsSorted = [...input.requiredForms].sort(
    (a, b) => (FORM_ORDER[a.formId] ?? 99) - (FORM_ORDER[b.formId] ?? 99),
  );

  const steps: DeclarationStep[] = [];
  let order = 0;

  for (const form of formsSorted) {
    // Étape 1 : ouvrir le formulaire
    steps.push({
      id: `open-${form.formId}`,
      order: order++,
      title: `Ouvrir ${form.label}`,
      description: form.reason,
      formId: form.formId,
      actionType: "open_form",
      ragSources: form.sources,
      requiresManualReview: form.confidence !== "high",
    });

    // Étapes suivantes : une par case proposée pour ce formulaire
    const formProposals = input.proposals.filter((p) => p.formId === form.formId);
    for (const p of formProposals) {
      steps.push({
        id: `${form.formId}-${p.boxOrLine}`,
        order: order++,
        title: `${p.boxOrLine} — ${p.label}`,
        description: p.explanation,
        formId: form.formId,
        sectionLabel: p.boxOrLine,
        actionType: p.amount != null
          ? (p.requiresManualReview ? "verify_amount" : "enter_amount")
          : "manual_review",
        amount: p.amount,
        targetBox: p.boxOrLine,
        sourceData: {
          category: p.category,
        },
        ragSources: p.ragSources,
        warning: p.blockingReason,
        requiresManualReview: p.requiresManualReview,
      });
    }
  }

  return steps;
}
