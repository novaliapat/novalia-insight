// Miroir Deno — voir src/lib/declaration/guidance/declarationStepBuilder.ts
import type {
  DeclarationStep,
  RequiredForm,
  TaxBoxProposal,
  TaxFormId,
  PrefillStatus,
} from "./guidanceSchemas.ts";

export interface BuildStepsInput {
  requiredForms: RequiredForm[];
  proposals: TaxBoxProposal[];
}

const FORM_ORDER: Record<string, number> = {
  preparation: 0,
  "2044": 1,
  "2047": 2,
  "2042-RICI": 3,
  "2042C": 4,
  "2042": 5,
  recap: 6,
  other: 9,
};

const PREFILLED_BOXES = new Set(["2TR", "2DC", "2CK", "2CG", "2BH", "3VZ"]);
const AUTO_REPORT_BOXES = new Set(["4BA", "4BC", "4BL"]);
const DO_NOT_MODIFY_BOXES = new Set(["8TK"]);

function computePrefillStatus(formId: TaxFormId, box: string): PrefillStatus {
  if (formId !== "2042") return "to_enter";
  if (DO_NOT_MODIFY_BOXES.has(box)) return "do_not_modify";
  if (AUTO_REPORT_BOXES.has(box)) return "auto_report";
  if (PREFILLED_BOXES.has(box)) return "prefilled";
  return "to_enter";
}

const round = (n: number | null | undefined): number | null =>
  n == null ? null : Math.round(n);

export function buildDeclarationSteps(input: BuildStepsInput): DeclarationStep[] {
  const steps: DeclarationStep[] = [];
  let order = 0;

  // BLOC 1 — préparation
  const detectedFormIds = new Set(input.requiredForms.map((f) => f.formId));
  const has2044 = detectedFormIds.has("2044");
  const has2047 = detectedFormIds.has("2047");
  const hasMobilier = input.proposals.some(
    (p) => p.formId === "2042" && ["2TR", "2DC", "2CK", "2CG", "2BH"].includes(p.boxOrLine),
  );
  const has3VZ = input.proposals.some(
    (p) => p.formId === "2042" && p.boxOrLine === "3VZ" && (p.amount ?? 0) > 0,
  );

  const prepInstructions: string[] = [];
  if (hasMobilier) prepInstructions.push("✅ Cochez « Revenus de capitaux mobiliers » (cases 2TR, 2DC, 2CK, 2CG)");
  if (has2044) prepInstructions.push("✅ Cochez « Revenus fonciers » → puis sélectionnez « Annexe n°2044 » (régime réel SCPI)");
  if (has3VZ) prepInstructions.push("✅ Cochez « Plus-values et gains divers » → ligne 3VZ");
  if (has2047) prepInstructions.push("✅ Cochez « Comptes à l'étranger, Revenus de source étrangère » → puis « Annexe n°2047 »");
  prepInstructions.push("⛔ NE cochez PAS les annexes 2074 ou 2086 si elles ne sont pas listées ci-dessus.");

  if (prepInstructions.length > 0) {
    steps.push({
      id: "prep-rubriques",
      order: order++,
      title: "Étape 1 — Sélectionner vos rubriques sur impots.gouv.fr",
      description: "À l'étape « Sélection des rubriques » :\n" + prepInstructions.join("\n"),
      formId: "preparation",
      actionType: "check_box",
      ragSources: [],
      requiresManualReview: false,
    });
  }

  // BLOCS 2-4 — formulaires
  const formsSorted = [...input.requiredForms].sort(
    (a, b) => (FORM_ORDER[a.formId] ?? 99) - (FORM_ORDER[b.formId] ?? 99),
  );

  for (const form of formsSorted) {
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

    const formProposals = input.proposals.filter((p) => p.formId === form.formId);
    for (const p of formProposals) {
      const prefillStatus = computePrefillStatus(p.formId, p.boxOrLine);
      const calculationNote =
        p.blockingReason && /=|\+|×|%/.test(p.blockingReason) ? p.blockingReason : undefined;
      const warning = calculationNote ? undefined : p.blockingReason;

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
        amount: round(p.amount),
        targetBox: p.boxOrLine,
        sourceData: { category: p.category },
        ragSources: p.ragSources,
        warning,
        requiresManualReview: p.requiresManualReview,
        calculationNote,
        prefillStatus,
      });
    }
  }

  // BLOC 5 — récapitulatif
  if (input.proposals.length > 0) {
    const statusLabel: Record<PrefillStatus, string> = {
      to_enter: "À saisir",
      prefilled: "Pré-rempli (vérifier)",
      auto_report: "Report automatique",
      do_not_modify: "Ne pas modifier",
    };
    const lines = input.proposals.map((p) => {
      const status = computePrefillStatus(p.formId, p.boxOrLine);
      const amt = p.amount != null ? `${Math.round(p.amount)} €` : "—";
      return `${p.formId} • ${p.boxOrLine} — ${p.label} : ${amt} (${statusLabel[status]})`;
    });

    steps.push({
      id: "recap-table",
      order: order++,
      title: "Tableau récapitulatif des cases",
      description: lines.join("\n"),
      formId: "recap",
      actionType: "verify_amount",
      ragSources: [],
      requiresManualReview: false,
    });

    steps.push({
      id: "recap-checklist",
      order: order++,
      title: "Checklist de validation finale",
      description: [
        "Σ intérêts d'emprunt répartis = total des attestations bancaires.",
        "Ligne 114 (résultat 2044) non négative sur la part étrangère.",
        "8TK reste pré-remplie et non modifiée (égale au total section 6 de la 2047).",
        "4BL ≤ 8TK si emprunt personnel (le NET ne peut excéder le BRUT).",
        "Toutes les pièces justificatives (relevés SCPI, attestations bancaires, IFU) sont conservées.",
      ].join("\n"),
      formId: "recap",
      actionType: "verify_amount",
      ragSources: [],
      requiresManualReview: false,
    });
  }

  return steps;
}
