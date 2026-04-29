import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const mockGenerate = vi.fn();
const mockGetSignedUrl = vi.fn();
const mockRemove = vi.fn();

let mockState: {
  exports: any[];
  loading: boolean;
  generating: boolean;
  error: string | null;
} = {
  exports: [],
  loading: false,
  generating: false,
  error: null,
};

vi.mock("@/hooks/useDeclarationExports", () => ({
  useDeclarationExports: () => ({
    ...mockState,
    generate: mockGenerate,
    getSignedUrl: mockGetSignedUrl,
    remove: mockRemove,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ExportPanel } from "./ExportPanel";

beforeEach(() => {
  vi.clearAllMocks();
  mockState = {
    exports: [],
    loading: false,
    generating: false,
    error: null,
  };
  mockGetSignedUrl.mockResolvedValue("https://signed.example/pdf.pdf");
});

describe("ExportPanel — règles de blocage", () => {
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

  it("bouton PDF désactivé si analysis absent", () => {
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis={false}
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    expect(
      screen.getByRole("button", { name: /générer le pdf/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Aucune analyse fiscale disponible/i)).toBeInTheDocument();
  });

  it("bouton PDF actif si analysis + guidance présents", () => {
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
    // Le bouton reste actif malgré le warning.
    expect(
      screen.getByRole("button", { name: /générer le pdf/i }),
    ).not.toBeDisabled();
  });
});

describe("ExportPanel — historique & génération", () => {
  it("affiche l'historique des exports", () => {
    mockState.exports = [
      {
        id: "e1",
        declaration_id: "abc",
        user_id: "u",
        export_type: "tax_summary_pdf",
        storage_path: "u/abc/file.pdf",
        file_name: "novalia-2024.pdf",
        include_audit: false,
        include_rag_sources: true,
        include_review_items: true,
        created_at: new Date().toISOString(),
        metadata: {},
      },
    ];
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    expect(screen.getByText("novalia-2024.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /télécharger novalia-2024.pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /supprimer novalia-2024.pdf/i }),
    ).toBeInTheDocument();
    // Bouton principal devient "Regénérer".
    expect(
      screen.getByRole("button", { name: /regénérer le pdf/i }),
    ).toBeInTheDocument();
  });

  it("charge la signedUrl pour la preview du dernier export", async () => {
    mockState.exports = [
      {
        id: "e1",
        declaration_id: "abc",
        user_id: "u",
        export_type: "tax_summary_pdf",
        storage_path: "u/abc/file.pdf",
        file_name: "novalia-2024.pdf",
        include_audit: false,
        include_rag_sources: true,
        include_review_items: true,
        created_at: new Date().toISOString(),
        metadata: {},
      },
    ];
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    await waitFor(() =>
      expect(mockGetSignedUrl).toHaveBeenCalledWith("u/abc/file.pdf"),
    );
    await waitFor(() => {
      const links = screen.getAllByRole("link");
      expect(
        links.some((l) => l.getAttribute("href") === "https://signed.example/pdf.pdf"),
      ).toBe(true);
    });
  });

  it("appelle generate et déclenche la mise à jour de la preview", async () => {
    mockGenerate.mockResolvedValue({
      exportId: "e2",
      fileName: "new.pdf",
      storagePath: "u/abc/new.pdf",
      signedUrl: "https://signed.example/new.pdf",
      sizeBytes: 1234,
    });
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /générer le pdf/i }));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));
  });

  it("affiche un état d'erreur si le hook remonte une erreur", () => {
    mockState.error = "boom";
    render(
      <ExportPanel
        declarationId="abc"
        hasAnalysis
        hasGuidance
        guidanceStatus="guidance_completed"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/boom/);
  });
});
