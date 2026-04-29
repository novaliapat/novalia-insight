import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { Upload, FileText, X, ArrowRight, Loader2, AlertCircle, CheckCircle2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "@/hooks/useDeclarationFlow";
import { useFileUpload, validateFile } from "@/hooks/useFileUpload";

interface FileUploadStepProps {
  declarationId: string | null;
  draftLoading: boolean;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onUpdate: (id: string, patch: Partial<UploadedFile>) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";

export const FileUploadStep = ({
  declarationId,
  draftLoading,
  files,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
}: FileUploadStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadOne, removeOne } = useFileUpload();
  const [busy, setBusy] = useState(false);

  const startUpload = async (entry: UploadedFile) => {
    if (!declarationId || !entry.file) return;
    onUpdate(entry.id, { status: "uploading", errorMessage: undefined });
    try {
      const { storagePath, dbId } = await uploadOne(entry.file, declarationId);
      onUpdate(entry.id, { status: "uploaded", storagePath, dbId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'upload";
      onUpdate(entry.id, { status: "failed", errorMessage: msg });
      toast.error(`${entry.name} : ${msg}`);
    }
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    if (!declarationId) {
      toast.error("Brouillon en cours de création, réessayez");
      return;
    }
    setBusy(true);
    const incoming: UploadedFile[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f);
      if (err) {
        toast.error(`${f.name} : ${err}`);
        continue;
      }
      incoming.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
        status: "pending",
      });
    }
    if (incoming.length > 0) {
      onAdd(incoming);
      // upload séquentiel pour éviter de saturer
      for (const entry of incoming) await startUpload(entry);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = async (entry: UploadedFile) => {
    onRemove(entry.id);
    try {
      await removeOne(entry);
    } catch {
      // silencieux : la ligne est déjà retirée côté UI
    }
  };

  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const canProceed = uploadedCount > 0 && !busy && !!declarationId;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Importez vos documents fiscaux</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          IFU, relevés d'assurance-vie, avis SCPI, justificatifs PER, comptes étrangers, etc. PDF, images.
        </p>
      </div>

      {draftLoading && !declarationId && (
        <Card className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Préparation de votre dossier…
        </Card>
      )}

      <Card
        onClick={() => declarationId && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed border-border transition-smooth p-12 text-center",
          declarationId
            ? "hover:border-accent/60 hover:bg-accent-soft/30 cursor-pointer"
            : "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 mb-4">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="font-medium text-foreground">Déposez vos fichiers ici</div>
        <div className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir</div>
        <div className="text-xs text-muted-foreground/80 mt-3">PDF, JPG, PNG, WEBP · 20 Mo max par fichier</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </Card>

      {files.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-medium text-foreground mb-3">
            {files.length} document{files.length > 1 ? "s" : ""}
          </div>
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{f.name}</div>
                    {f.errorMessage && (
                      <div className="truncate text-xs text-destructive">{f.errorMessage}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {(f.size / 1024).toFixed(0)} Ko
                  </div>
                  <StatusIcon status={f.status} />
                </div>
                <div className="flex items-center gap-1">
                  {f.status === "failed" && f.file && (
                    <button
                      onClick={() => void startUpload(f)}
                      className="text-muted-foreground hover:text-foreground transition-smooth p-1"
                      aria-label="Réessayer"
                      title="Réessayer"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => void handleRemove(f)}
                    className="text-muted-foreground hover:text-destructive transition-smooth p-1"
                    aria-label="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <LegalDisclaimer compact />

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed} size="lg" className="gap-2">
          Lancer l'extraction
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

function StatusIcon({ status }: { status: UploadedFile["status"] }) {
  if (status === "uploading" || status === "processing")
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "uploaded" || status === "processed")
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return null;
}
