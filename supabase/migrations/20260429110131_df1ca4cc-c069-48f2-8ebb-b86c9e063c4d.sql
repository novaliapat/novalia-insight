ALTER TABLE public.declarations
ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'no_review_needed';

ALTER TABLE public.declarations
DROP CONSTRAINT IF EXISTS declarations_review_status_check;

ALTER TABLE public.declarations
ADD CONSTRAINT declarations_review_status_check
CHECK (review_status IN ('no_review_needed', 'review_pending', 'review_completed', 'review_partially_ignored'));

CREATE INDEX IF NOT EXISTS idx_declarations_review_status ON public.declarations(review_status);