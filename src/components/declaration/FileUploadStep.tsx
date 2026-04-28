import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { Upload, FileText, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { UploadedFile } from "@/hooks/useDeclarationFlow";

interface FileUploadStepProps {
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 20 * 1024 * 1024;

export const FileUploadStep = ({ files, onAdd, onRemove, onNext }: FileUploadStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming: UploadedFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} : fichier trop volumineux (max 20 Mo)`);
        continue;
      }
      incoming.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
      });
    }
    if (incoming.length > 0) {
      onAdd(incoming);
      toast.success(`${incoming.length} fichier(s) ajouté(s)`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Importez vos documents fiscaux</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          IFU, relevés d'assurance-vie, avis SCPI, justificatifs PER, comptes étrangers, etc. PDF, images.
        </p>
      </div>

      <Card
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-border hover:border-accent/60 hover:bg-accent-soft/30 transition-smooth cursor-pointer p-12 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 mb-4">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="font-medium text-foreground">Déposez vos fichiers ici</div>
        <div className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir</div>
        <div className="text-xs text-muted-foreground/80 mt-3">PDF, JPG, PNG · 20 Mo max par fichier</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </Card>

      {files.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-medium text-foreground mb-3">
            {files.length} document{files.length > 1 ? "s" : ""} importé{files.length > 1 ? "s" : ""}
          </div>
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="truncate text-sm">{f.name}</div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {(f.size / 1024).toFixed(0)} Ko
                  </div>
                </div>
                <button
                  onClick={() => onRemove(f.id)}
                  className="text-muted-foreground hover:text-destructive transition-smooth"
                  aria-label="Retirer"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <LegalDisclaimer compact />

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={files.length === 0} size="lg" className="gap-2">
          Lancer l'extraction
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
