import { useCallback, useState } from "react";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

export type FlowStep = 1 | 2 | 3 | 4 | 5;

export type FileStatus = "pending" | "uploading" | "uploaded" | "failed" | "processing" | "processed";

export interface UploadedFile {
  /** id local côté client */
  id: string;
  /** id de la ligne declaration_files (présent une fois upload réussi) */
  dbId?: string;
  name: string;
  size: number;
  type: string;
  /** Chemin storage : {user_id}/{declaration_id}/{filename} */
  storagePath?: string;
  status: FileStatus;
  errorMessage?: string;
  /** Référence locale pour réessayer un upload échoué */
  file?: File;
}

export interface DeclarationFlowState {
  step: FlowStep;
  /** id de la déclaration brouillon créée au démarrage */
  declarationId: string | null;
  files: UploadedFile[];
  extractedData: ExtractedData | null;
  validatedData: ExtractedData | null;
  analysis: FiscalAnalysis | null;
}

const initialState: DeclarationFlowState = {
  step: 1,
  declarationId: null,
  files: [],
  extractedData: null,
  validatedData: null,
  analysis: null,
};

export function useDeclarationFlow() {
  const [state, setState] = useState<DeclarationFlowState>(initialState);

  const goTo = useCallback((step: FlowStep) => setState((s) => ({ ...s, step })), []);
  const next = useCallback(
    () => setState((s) => ({ ...s, step: Math.min(5, s.step + 1) as FlowStep })),
    []
  );
  const prev = useCallback(
    () => setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as FlowStep })),
    []
  );

  const setDeclarationId = useCallback(
    (id: string) => setState((s) => ({ ...s, declarationId: id })),
    []
  );

  const setFiles = useCallback((files: UploadedFile[]) => setState((s) => ({ ...s, files })), []);
  const addFiles = useCallback(
    (newFiles: UploadedFile[]) => setState((s) => ({ ...s, files: [...s.files, ...newFiles] })),
    []
  );
  const updateFile = useCallback(
    (id: string, patch: Partial<UploadedFile>) =>
      setState((s) => ({
        ...s,
        files: s.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })),
    []
  );
  const removeFile = useCallback(
    (id: string) => setState((s) => ({ ...s, files: s.files.filter((f) => f.id !== id) })),
    []
  );

  const setExtractedData = useCallback(
    (data: ExtractedData) => setState((s) => ({ ...s, extractedData: data })),
    []
  );
  const setValidatedData = useCallback(
    (data: ExtractedData) => setState((s) => ({ ...s, validatedData: data })),
    []
  );
  const setAnalysis = useCallback(
    (analysis: FiscalAnalysis) => setState((s) => ({ ...s, analysis })),
    []
  );

  const reset = useCallback(() => setState(initialState), []);

  return {
    state,
    goTo,
    next,
    prev,
    setDeclarationId,
    setFiles,
    addFiles,
    updateFile,
    removeFile,
    setExtractedData,
    setValidatedData,
    setAnalysis,
    reset,
  };
}
