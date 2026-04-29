import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DeclarationGuidance } from "@/lib/declaration/guidance/guidanceSchemas";

// ─── Mock du hook avant import du composant ───────────────────────
const hookState = {
  guidance: null as DeclarationGuidance | null,
  status: null as string | null,
  loading: false,
  generating: false,
  error: null as string | null,
  loadGuidance: vi.fn(),
  generateGuidance: vi.fn(),
  regenerateGuidance: vi.fn(),
};
vi.mock("@/hooks/useDeclarationGuidance", () => ({
  useDeclarationGuidance: () => hookState,
}));

// Importé APRÈS le mock
import { DeclarationGuidancePanel } from "./DeclarationGuidancePanel";

const officialSrc = {
  title: "Brochure IR 2025",
  isOfficialSource: true,
  provenance: "official_brochure" as const,
  pageNumber: 124,
  formId: "2042" as const,
  boxCodes: ["2DC"],
  excerpt: "Les dividendes sont à reporter case 2DC.",
};

const baseGuidance: DeclarationGuidance = {
  taxYear: 2025,
  taxpayerSummary: {
    taxYear: 2025,
    detectedCategories: ["ifu", "scpi"],
    hasForeignIncome: true,
    hasRealEstateIncome: true,
  },
  detectedSituations: ["Revenus de capitaux mobiliers issus d'un IFU."],
  requiredForms: [
    {
      formId: "2042",
      label: "Déclaration principale",
      reason: "Revenus de capitaux mobiliers détectés.",
      required: true,
      confidence: "high",
      status: "confirmed",
      sources: [officialSrc],
      legalBasisSources: [],
    },
  ],
  declarationSteps: [],
  taxBoxProposals: [
    {
      formId: "2042",
      boxOrLine: "2DC",
      label: "Dividendes éligibles à l'abattement de 40 %",
      amount: 1500,
      category: "ifu",
      explanation: "Reporter le montant des dividendes IFU.",
      confidence: "high",
      status: "confirmed",
      ragSources: [officialSrc],
      legalBasisSources: [],
      requiresManualReview: false,
    },
    {
      formId: "2042",
      boxOrLine: "4BL",
      label: "Revenus fonciers étrangers",
      amount: null,
      category: "scpi",
      explanation: "Selon convention bilatérale.",
      confidence: "medium",
      status: "needs_review",
      ragSources: [{ ...officialSrc, boxCodes: ["4BL"], pageNumber: 154 }],
      legalBasisSources: [],
      requiresManualReview: true,
      blockingReason: "Convention fiscale à vérifier avant tout report.",
    },
  ],
  manualReviewItems: [
    {
      id: "scpi-foreign-convention",
      category: "scpi",
      reason: "Revenus SCPI étrangers : convention à confirmer.",
      suggestedAction: "Identifier la convention bilatérale.",
      relatedFormId: "2047",
    },
  ],
  missingSources: [],
  warnings: [],
  confidence: "medium",
  disclaimer: "Disclaimer test.",
};

beforeEach(() => {
  hookState.guidance = null;
  hookState.status = null;
  hookState.loading = false;
  hookState.generating = false;
  hookState.error = null;
  hookState.generateGuidance = vi.fn();
  hookState.regenerateGuidance = vi.fn();
});

describe("DeclarationGuidancePanel", () => {
  it("affiche le bouton 'Générer le guide' si guidance absent", () => {
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getByRole("button", { name: /générer le guide/i })).toBeInTheDocument();
  });

  it("affiche les formulaires requis quand guidance présent", () => {
    hookState.guidance = baseGuidance;
    hookState.status = "guidance_completed_with_warnings";
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getByText(/Formulaires et annexes/i)).toBeInTheDocument();
    expect(screen.getByText(/Formulaire 2042/i)).toBeInTheDocument();
  });

  it("la proposition 2DC affiche le montant et la source brochure (page)", () => {
    hookState.guidance = baseGuidance;
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getAllByText(/2DC/).length).toBeGreaterThan(0);
    // formatEuro utilise un narrow no-break space
    expect(
      screen.getByText((t) => /1\s?500,00/.test(t.replace(/\u202f/g, " "))),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Brochure IR 2025.*p\.124/).length,
    ).toBeGreaterThan(0);
  });

  it("la proposition 4BL avec requiresManualReview affiche blockingReason", () => {
    hookState.guidance = baseGuidance;
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getAllByText(/4BL/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/convention fiscale à vérifier/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/à déterminer/i)).toBeInTheDocument();
  });

  it("missingSources : panneau caché si vide", () => {
    hookState.guidance = baseGuidance;
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.queryByText(/Sources fiscales manquantes/i)).not.toBeInTheDocument();
  });

  it("missingSources : panneau visible si non vide", () => {
    hookState.guidance = {
      ...baseGuidance,
      missingSources: [
        {
          category: "ifu",
          reason: "Aucune source officielle ingérée.",
          suggestedSources: ["Brochure IR 2025"],
          blocksHighConfidence: true,
        },
      ],
    };
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getByText(/Sources fiscales manquantes/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune source officielle ingérée/i)).toBeInTheDocument();
  });

  it("ManualReviewGuidancePanel affiche les items", () => {
    hookState.guidance = baseGuidance;
    render(<DeclarationGuidancePanel declarationId="abc" />);
    expect(screen.getByText(/Points à vérifier manuellement/i)).toBeInTheDocument();
    expect(
      screen.getByText(/SCPI étrangers : convention à confirmer/i),
    ).toBeInTheDocument();
  });

  it("mode déconnecté : message si pas de declarationId ni initialGuidance", () => {
    render(<DeclarationGuidancePanel declarationId={null} />);
    expect(
      screen.getByText(/Enregistrez l'analyse pour générer le guide/i),
    ).toBeInTheDocument();
  });
});
