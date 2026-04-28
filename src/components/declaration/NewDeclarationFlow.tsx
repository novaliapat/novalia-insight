import { useNavigate } from "react-router-dom";
import { useDeclarationFlow } from "@/hooks/useDeclarationFlow";
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
  const flow = useDeclarationFlow();
  const { state } = flow;

  const handleSave = () => {
    toast.success("Analyse enregistrée (mock)");
    navigate("/");
  };

  return (
    <div className="space-y-8">
      {/* Stepper */}
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

      {/* Step content */}
      <div>
        {state.step === 1 && (
          <FileUploadStep
            files={state.files}
            onAdd={flow.addFiles}
            onRemove={flow.removeFile}
            onNext={flow.next}
          />
        )}
        {state.step === 2 && (
          <ExtractionReviewStep
            files={state.files}
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
          <FinalSummaryStep analysis={state.analysis} onPrev={flow.prev} onSave={handleSave} />
        )}
      </div>
    </div>
  );
};
