ALTER TABLE public.declaration_review_items
  DROP CONSTRAINT IF EXISTS review_items_source_type_check;

ALTER TABLE public.declaration_review_items
  ADD CONSTRAINT review_items_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'consistency_issue',
    'warning',
    'missing_data',
    'weak_evidence',
    'normalization_warning'
  ]));