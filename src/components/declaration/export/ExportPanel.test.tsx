import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useDeclarationExports", () => ({
  useDeclarationExports: () => ({
    exports: [],
    loading: false,
    generating: false,
    generate: vi.fn(),
    getSignedUrl: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { ExportPanel } from "./ExportPanel";

beforeEach(() => vi.clearAllMocks());

describe("ExportPanel — règle PDF guidance", () => {
  it("bouton PDF désactivé et message si guidance absent", () => {
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        analysisStatus="analysis_completed"
        hasGuidance={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /générer le pdf/i });
    expect(btn).toBeDisabled();
    expect(
      screen.getByText(/Le PDF sera disponible après génération du guide/i),
    ).toBeInTheDocument();
  });

  it("bouton PDF actif si guidance présent", () => {
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        analysisStatus="analysis_completed"
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    expect(
      screen.getByRole("button", { name: /générer le pdf/i }),
    ).not.toBeDisabled();
  });

  it("bandeau d'avertissement si guidance avec warnings", () => {
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        analysisStatus="analysis_completed"
        hasGuidance
        guidanceStatus="guidance_completed_with_warnings"
      />,
    );
    expect(
      screen.getByText(/guide déclaratif avec alertes/i),
    ).toBeInTheDocument();
  });
});
