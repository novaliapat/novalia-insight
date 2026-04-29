// Règles déterministes de verrouillage avant validation / finalisation.
// PURE — utilisable côté front (UI) et en tests.
//
// Niveaux :
//  - "none"                  : rien à signaler, on continue librement
//  - "warning"               : information non-bloquante (ignorés sans erreur)
//  - "confirmation_required" : pending mineurs, exige une confirmation explicite
//  - "blocked"               : pending critique (error) ou extraction KO

import type { DeclarationReviewStatus, ReviewItemStatus } from "./computeReviewStatus";
import type { ExtractionStatus } from "../contracts/statusContract";

export type ReviewBlockingLevel =
  | "none"
  | "warning"
  | "confirmation_required"
  | "blocked";

export type ReviewBlockingSeverity = "info" | "warning" | "error";

export interface ReviewBlockingItem {
  status: ReviewItemStatus;
  severity: ReviewBlockingSeverity;
}

export interface ReviewBlockingInput {
  reviewStatus: DeclarationReviewStatus | null | undefined;
  extractionStatus: ExtractionStatus | null | undefined;
  items: ReviewBlockingItem[];
}

export interface ReviewBlockingResult {
  level: ReviewBlockingLevel;
  title: string;
  message: string;
  blockingReasons: string[];
  canContinue: boolean;
  counts: {
    pending: number;
    pendingError: number;
    pendingWarning: number;
    pendingInfo: number;
    resolved: number;
    ignored: number;
    ignoredError: number;
  };
}

function countItems(items: ReviewBlockingItem[]) {
  return items.reduce(
    (acc, it) => {
      if (it.status === "pending") {
        acc.pending += 1;
        if (it.severity === "error") acc.pendingError += 1;
        else if (it.severity === "warning") acc.pendingWarning += 1;
        else acc.pendingInfo += 1;
      } else if (it.status === "resolved") {
        acc.resolved += 1;
      } else if (it.status === "ignored") {
        acc.ignored += 1;
        if (it.severity === "error") acc.ignoredError += 1;
      }
      return acc;
    },
    {
      pending: 0,
      pendingError: 0,
      pendingWarning: 0,
      pendingInfo: 0,
      resolved: 0,
      ignored: 0,
      ignoredError: 0,
    },
  );
}

export function evaluateReviewBlocking(input: ReviewBlockingInput): ReviewBlockingResult {
  const counts = countItems(input.items);
  const { extractionStatus, reviewStatus, items } = input;

  // -- D. Blocage fort -----------------------------------------------------
  if (extractionStatus === "extraction_failed") {
    return {
      level: "blocked",
      title: "Extraction échouée",
      message:
        "L'extraction des documents a échoué. Vous ne pouvez pas finaliser cette déclaration tant qu'elle n'a pas été reprise.",
      blockingReasons: ["L'extraction des documents a échoué."],
      canContinue: false,
      counts,
    };
  }

  if (counts.pendingError > 0) {
    return {
      level: "blocked",
      title: "Points critiques à traiter",
      message:
        "Des points critiques doivent être traités avant de poursuivre. Ouvrez la revue rapide pour les résoudre ou les ignorer en connaissance de cause.",
      blockingReasons: [
        `${counts.pendingError} point${counts.pendingError > 1 ? "s" : ""} critique${counts.pendingError > 1 ? "s" : ""} non traité${counts.pendingError > 1 ? "s" : ""}.`,
      ],
      canContinue: false,
      counts,
    };
  }

  if (extractionStatus === "extraction_needs_review" && items.length === 0) {
    return {
      level: "blocked",
      title: "Revue manuelle requise",
      message:
        "L'extraction est marquée comme nécessitant une revue manuelle, mais aucun point de revue n'a encore été instruit. Reprenez l'extraction avant de poursuivre.",
      blockingReasons: [
        "Extraction marquée à revoir et aucun point de revue n'a été traité.",
      ],
      canContinue: false,
      counts,
    };
  }

  // -- A. Aucun problème ---------------------------------------------------
  const extractionOk =
    extractionStatus === "extraction_completed" ||
    extractionStatus === "extraction_completed_with_warnings" ||
    extractionStatus === null ||
    extractionStatus === undefined;

  if (
    extractionOk &&
    extractionStatus !== "extraction_completed_with_warnings" &&
    (reviewStatus === "no_review_needed" || reviewStatus === "review_completed") &&
    counts.pending === 0
  ) {
    return {
      level: "none",
      title: "Prêt à finaliser",
      message: "Aucun point de revue n'est en attente.",
      blockingReasons: [],
      canContinue: true,
      counts,
    };
  }

  // -- C. Confirmation obligatoire ----------------------------------------
  if (counts.pending > 0) {
    const reasons: string[] = [];
    if (counts.pendingWarning > 0)
      reasons.push(
        `${counts.pendingWarning} avertissement${counts.pendingWarning > 1 ? "s" : ""} non traité${counts.pendingWarning > 1 ? "s" : ""}.`,
      );
    if (counts.pendingInfo > 0)
      reasons.push(
        `${counts.pendingInfo} information${counts.pendingInfo > 1 ? "s" : ""} non traitée${counts.pendingInfo > 1 ? "s" : ""}.`,
      );
    return {
      level: "confirmation_required",
      title: "Confirmation requise",
      message:
        "Certains points de revue ne sont pas encore traités. Confirmez que vous souhaitez continuer malgré ces points ; ce choix sera tracé dans l'audit.",
      blockingReasons: reasons,
      canContinue: true,
      counts,
    };
  }

  // -- B. Warning simple ---------------------------------------------------
  if (
    reviewStatus === "review_partially_ignored" ||
    counts.ignored > 0 ||
    extractionStatus === "extraction_completed_with_warnings"
  ) {
    const reasons: string[] = [];
    if (counts.ignored > 0)
      reasons.push(
        `${counts.ignored} point${counts.ignored > 1 ? "s" : ""} ignoré${counts.ignored > 1 ? "s" : ""}.`,
      );
    if (extractionStatus === "extraction_completed_with_warnings")
      reasons.push("L'extraction a remonté des avertissements.");
    return {
      level: "warning",
      title: "Quelques points à noter",
      message:
        "Certains points ont été ignorés ou signalés en avertissement. Vous pouvez continuer ; ces choix resteront tracés dans l'audit.",
      blockingReasons: reasons,
      canContinue: true,
      counts,
    };
  }

  // Fallback sûr
  return {
    level: "none",
    title: "Prêt à finaliser",
    message: "Aucun point de revue n'est en attente.",
    blockingReasons: [],
    canContinue: true,
    counts,
  };
}
