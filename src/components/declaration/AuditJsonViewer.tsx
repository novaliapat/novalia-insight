import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { ExtractionAudit } from "@/lib/declaration/audit/extractionAudit";

export const AuditJsonViewer = ({ audit }: { audit: ExtractionAudit | null }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!audit) return null;

  const json = JSON.stringify(audit, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("JSON d'audit copié");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} className="gap-2">
        <Code2 className="h-4 w-4" />
        {open ? "Masquer le JSON d'audit" : "Afficher le JSON d'audit"}
      </Button>
      {open && (
        <div className="relative rounded-md border border-border bg-muted/40 p-3">
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-2 top-2 gap-1.5"
            onClick={copy}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copier
          </Button>
          <pre className="text-[11px] leading-relaxed overflow-auto max-h-96 font-mono pr-20">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
};
