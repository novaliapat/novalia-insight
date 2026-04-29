-- Statut d'analyse fiscale (séparé de extraction_status et review_status)
ALTER TABLE public.declarations
  ADD COLUMN analysis_status text NOT NULL DEFAULT 'analysis_not_started';

-- Traçabilité du modèle IA utilisé
ALTER TABLE public.declaration_fiscal_analysis
  ADD COLUMN model_used text,
  ADD COLUMN prompt_version text;

-- Index pour retrouver vite les sources d'une analyse
CREATE INDEX IF NOT EXISTS idx_tax_rag_sources_used_analysis
  ON public.tax_rag_sources_used(analysis_id);