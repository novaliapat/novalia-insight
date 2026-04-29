import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DeclarationReviewStatus } from "@/lib/declaration/review/computeReviewStatus";
import type { ExtractionStatus } from "@/lib/declaration/contracts/statusContract";
import { ExtractionStatusEnum } from "@/lib/declaration/contracts/statusContract";

interface DeclarationMeta {
  reviewStatus: DeclarationReviewStatus | null;
  extractionStatus: ExtractionStatus | null;
}

export function useDeclarationMeta(declarationId: string | null | undefined) {
  const [meta, setMeta] = useState<DeclarationMeta>({
    reviewStatus: null,
    extractionStatus: null,
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [{ data: decl }, { data: ext }] = await Promise.all([
        supabase.from("declarations").select("review_status").eq("id", id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("declaration_extracted_data")
          .select("extraction_status")
          .eq("declaration_id", id)
          .maybeSingle(),
      ]);
      const parsedExt = ext?.extraction_status
        ? ExtractionStatusEnum.safeParse(ext.extraction_status)
        : null;
      setMeta({
        reviewStatus: (decl?.review_status as DeclarationReviewStatus) ?? null,
        extractionStatus: parsedExt?.success ? parsedExt.data : null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (declarationId) void load(declarationId);
  }, [declarationId, load]);

  return { ...meta, loading, reload: () => declarationId && load(declarationId) };
}
