import type { RagSource } from "@/lib/rag/ragSchemas";
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import { RagCategoryBadge } from "./RagCategoryBadge";
import { RagSourceCard } from "./RagSourceCard";
import { WarningCard } from "@/components/declaration/WarningCard";

interface Props {
  category: TaxCategory;
  sources: RagSource[];
  /** Si vrai, aucune source pertinente — case "à vérifier manuellement". */
  insufficient?: boolean;
}

export const RagSourcesPanel = ({ category, sources, insufficient }: Props) => {
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <RagCategoryBadge category={category} />
        <span className="text-[10px] text-muted-foreground">
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
      </div>
      {insufficient ? (
        <WarningCard
          title="À vérifier manuellement"
          message="Aucune source RAG suffisamment pertinente n'a été trouvée pour cette case dans la bibliothèque catégorielle."
        />
      ) : (
        <div className="space-y-2">
          {sources.map((s, i) => (
            <RagSourceCard key={i} source={s} />
          ))}
        </div>
      )}
    </div>
  );
};
