ALTER TABLE public.declaration_extracted_data
ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'extraction_completed';

ALTER TABLE public.declaration_extracted_data
DROP CONSTRAINT IF EXISTS declaration_extracted_data_extraction_status_check;

ALTER TABLE public.declaration_extracted_data
ADD CONSTRAINT declaration_extracted_data_extraction_status_check
CHECK (extraction_status IN (
  'extraction_not_started',
  'extraction_processing',
  'extraction_completed',
  'extraction_completed_with_warnings',
  'extraction_failed',
  'extraction_needs_review'
));