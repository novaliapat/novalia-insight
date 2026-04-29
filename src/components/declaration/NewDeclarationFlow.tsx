import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeclarationFlow } from "@/hooks/useDeclarationFlow";
import { useDeclarationDraft } from "@/hooks/useDeclarationDraft";
import { useFinalizeDeclaration } from "@/hooks/useDeclarationPersistence";
import { useAuth } from "@/hooks/useAuth";
import { useDeclarationMeta } from "@/hooks/useDeclarationMeta";
import { useReviewBlockingState } from "@/hooks/useReviewBlockingState";
import { ReviewBlockingBanner } from "./review/ReviewBlockingBanner";
import { ReviewOverrideDialog } from "./review/ReviewOverrideDialog";
import { FileUploadStep } from "./FileUploadStep";
import { ExtractionReviewStep } from "./ExtractionReviewStep";
import { ManualValidationStep } from "./ManualValidationStep";
import { FiscalAnalysisStep } from "./FiscalAnalysisStep";
import { FinalSummaryStep } from "./FinalSummaryStep";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { num: 1, label: "Documents" },
  { num: 2, label: "Extraction" },
  { num: 3, label: "Validation" },
  { num: 4, label: "Analyse" },
  { num: 5, label: "Synthèse" },
] as const;

export const NewDeclarationFlow = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const flow = useDeclarationFlow();
  const { state } = flow;
  const { declarationId: draftId, loading: draftLoading } = useDeclarationDraft();
  const { finalize, saving } = useFinalizeDeclaration();

  // Synchronise le declarationId draft dans le state du flow
  useEffect(() => {
    if (draftId && state.declarationId !== draftId) {
      flow.setDeclarationId(draftId);
    }
  }, [draftId, state.declarationId, flow]);

  // -- Verrouillage progressif avant analyse / finalisation --------------
  const meta = useDeclarationMeta(state.declarationId);
  const blocking = useReviewBlockingState({
    declarationId: state.declarationId,
    reviewStatus: meta.reviewStatus,
    extractionStatus: meta.extractionStatus,
  });
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "to_analysis" | "save">(null);

  const tryProceedToAnalysis = () => {
    const lvl = blocking.result.level;
    if (lvl === "blocked") {
      toast.error(blocking.result.title);
      return;
    }
    if (lvl === "confirmation_required") {
      setPendingAction("to_analysis");
      setOverrideOpen(true);
      return;
    }
    flow.next();
  };

  const doSave = async () => {
    if (!user) {
      toast.error("Session expirée");
      return;
    }
    if (!state.declarationId || !state.validatedData || !state.analysis) {
      toast.error("Données incomplètes");
      return;
    }
    const ok = await finalize({
      declarationId: state.declarationId,
      validated: state.validatedData,
      analysis: state.analysis,
    });
    if (ok) {
      toast.success("Analyse enregistrée");
      navigate(`/declaration/${state.declarationId}`);
    } else {
      toast.error("Échec de l'enregistrement");
    }
  };

  const handleSave = async () => {
    const lvl = blocking.result.level;
    if (lvl === "blocked") {
      toast.error(blocking.result.title);
      return;
    }
    if (lvl === "confirmation_required") {
      setPendingAction("save");
      setOverrideOpen(true);
      return;
    }
    await doSave();
  };

  const handleOverrideConfirmed = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === "to_analysis") {
      flow.next();
    } else if (action === "save") {
      await doSave();
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <ol className="flex items-center justify-between gap-2">
          {STEPS.map((s, idx) => {
            const done = state.step > s.num;
            const active = state.step === s.num;
            return (
              <li key={s.num} className="flex-1 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-smooth flex-shrink-0",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-accent text-accent-foreground shadow-gold",
                    !done && !active && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : s.num}
                </div>
                <div
                  className={cn(
                    "hidden md:block text-xs font-medium",
                    (active || done) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px", done ? "bg-primary" : "bg-border")} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div>
        {state.step === 1 && (
          <FileUploadStep
            declarationId={state.declarationId}
            draftLoading={draftLoading}
            files={state.files}
            onAdd={flow.addFiles}
            onUpdate={flow.updateFile}
            onRemove={flow.removeFile}
            onNext={flow.next}
          />
        )}
        {state.step === 2 && (
          <ExtractionReviewStep
            declarationId={state.declarationId}
            extractedData={state.extractedData}
            onExtracted={flow.setExtractedData}
            onPrev={flow.prev}
            onNext={flow.next}
          />
        )}
        {state.step === 3 && state.extractedData && (
          <ManualValidationStep
            data={state.extractedData}
            onValidated={(d) => {
              flow.setValidatedData(d);
              flow.next();
            }}
            onPrev={flow.prev}
          />
        )}
        {state.step === 4 && state.validatedData && (
          <FiscalAnalysisStep
            validatedData={state.validatedData}
            analysis={state.analysis}
            onAnalyzed={flow.setAnalysis}
            onPrev={flow.prev}
            onNext={flow.next}
          />
        )}
        {state.step === 5 && state.analysis && (
          <FinalSummaryStep
            analysis={state.analysis}
            onPrev={flow.prev}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};
