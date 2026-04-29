import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useDeclarationReviewItems, type ReviewItemStatus } from "@/hooks/useDeclarationReviewItems";
import { ReviewItemCard } from "./ReviewItemCard";
import { toast } from "sonner";

const FILTERS: Array<{ key: ReviewItemStatus | "all"; label: string }> = [
  { key: "pending", label: "À traiter" },
  { key: "resolved", label: "Corrigés" },
  { key: "ignored", label: "Ignorés" },
  { key: "all", label: "Tout" },
];

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

interface Props {
  declarationId: string;
}

export function QuickReviewPanel({ declarationId }: Props) {
  const { items, counts, loading, error, markResolved, markIgnored, reopen, setNote } =
    useDeclarationReviewItems(declarationId);
  const [filter, setFilter] = useState<ReviewItemStatus | "all">("pending");
  const [open, setOpen] = useState(true);

  const filtered = useMemo(() => {
    const list = filter === "all" ? items : items.filter((i) => i.status === filter);
    return [...list].sort((a, b) => {
      // Pending d'abord, puis par sévérité.
      if (a.status !== b.status) {
        if (a.status === "pending") return -1;
        if (b.status === "pending") return 1;
      }
      return (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    });
  }, [items, filter]);

  if (!loading && items.length === 0 && !error) return null;

  const safe = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); toast.success(msg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action échouée"); }
  };

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-smooth"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="text-left min-w-0">
            <div className="font-medium text-foreground">Revue rapide des données extraites</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {counts.pending} à traiter · {counts.resolved} corrigés · {counts.ignored} ignorés
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {counts.pending > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              {counts.pending} point{counts.pending > 1 ? "s" : ""} à traiter
            </Badge>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {error && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const c = f.key === "all" ? items.length : counts[f.key as ReviewItemStatus];
              return (
                <Button
                  key={f.key}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className={`ml-1.5 text-[10px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                    {c}
                  </span>
                </Button>
              );
            })}
          </div>

          {loading && <div className="text-sm text-muted-foreground">Chargement…</div>}

          {!loading && filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Aucun point dans cette catégorie.
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((it) => (
              <ReviewItemCard
                key={it.id}
                item={it}
                onResolve={(i) => safe(() => markResolved(i), "Point marqué comme corrigé")}
                onIgnore={(i) => safe(() => markIgnored(i), "Point ignoré")}
                onReopen={(i) => safe(() => reopen(i), "Point rouvert")}
                onSaveNote={(i, n) => safe(() => setNote(i, n), "Note enregistrée")}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
