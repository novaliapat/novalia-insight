import { Badge } from "@/components/ui/badge";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import { BookOpen } from "lucide-react";

export const RagCategoryBadge = ({ category }: { category: TaxCategory }) => (
  <Badge variant="outline" className="gap-1 text-[10px] font-medium">
    <BookOpen className="h-3 w-3 text-accent" />
    Bibliothèque {TaxCategoryLabel[category]}
  </Badge>
);
