import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, AlertCircle, Info, Check, EyeOff, RotateCcw, MessageSquarePlus } from "lucide-react";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import type { ReviewItem } from "@/hooks/useDeclarationReviewItems";

const SEVERITY_META = {
  error: { Icon: AlertCircle, color: "text-destructive", label: "Erreur" },
  warning: { Icon: AlertTriangle, color: "text-warning", label: "Avertissement" },
  info: { Icon: Info, color: "text-primary", label: "Info" },
} as const;

const SOURCE_LABEL: Record<ReviewItem["source_type"], string> = {
  consistency_issue: "Incohérence",
  warning: "Avertissement IA",
  missing_data: "Donnée manquante",
};

interface Props {
  item: ReviewItem;
  onResolve: (item: ReviewItem) => Promise<void>;
  onIgnore: (item: ReviewItem) => Promise<void>;
  onReopen: (item: ReviewItem) => Promise<void>;
  onSaveNote: (item: ReviewItem, note: string | null) => Promise<void>;
}

export function ReviewItemCard({ item, onResolve, onIgnore, onReopen, onSaveNote }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);

  const sev = SEVERITY_META[item.severity];
  const SevIcon = sev.Icon;

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <SevIcon className={`h-4 w-4 shrink-0 mt-0.5 ${sev.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[item.source_type]}</Badge>
            {item.source_code && (
              <Badge variant="secondary" className="text-[10px] font-mono">{item.source_code}</Badge>
            )}
            {item.field && (
              <span className="text-[11px] text-muted-foreground font-mono truncate">{item.field}</span>
            )}
            <ReviewStatusBadge status={item.status} />
          </div>
          <p className="text-sm text-foreground">{item.message}</p>
          {item.note && !editingNote && (
            <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-border pl-2">
              {item.note}
            </div>
          )}
        </div>
      </div>

      {editingNote && (
        <div className="space-y-2">
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ajouter une note interne…"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setEditingNote(false); setNoteDraft(item.note ?? ""); }}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => wrap(async () => {
                await onSaveNote(item, noteDraft.trim() ? noteDraft.trim() : null);
                setEditingNote(false);
              })}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {!editingNote && (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditingNote(true)} disabled={busy}>
            <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
            {item.note ? "Modifier la note" : "Ajouter une note"}
          </Button>
          {item.status === "pending" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => wrap(() => onIgnore(item))} disabled={busy}>
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Ignorer
              </Button>
              <Button size="sm" onClick={() => wrap(() => onResolve(item))} disabled={busy}>
                <Check className="h-3.5 w-3.5 mr-1" /> Marquer corrigé
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => wrap(() => onReopen(item))} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rouvrir
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
