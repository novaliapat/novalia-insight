-- Table declaration_exports
CREATE TABLE IF NOT EXISTS public.declaration_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid NOT NULL REFERENCES public.declarations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  export_type text NOT NULL DEFAULT 'tax_summary_pdf',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  include_audit boolean NOT NULL DEFAULT false,
  include_rag_sources boolean NOT NULL DEFAULT true,
  include_review_items boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS declaration_exports_declaration_id_idx
  ON public.declaration_exports(declaration_id);
CREATE INDEX IF NOT EXISTS declaration_exports_user_id_idx
  ON public.declaration_exports(user_id);

ALTER TABLE public.declaration_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own exports"
  ON public.declaration_exports FOR SELECT
  USING (auth.uid() = user_id AND public.owns_declaration(declaration_id));

CREATE POLICY "Users insert own exports"
  ON public.declaration_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.owns_declaration(declaration_id));

CREATE POLICY "Users update own exports"
  ON public.declaration_exports FOR UPDATE
  USING (auth.uid() = user_id AND public.owns_declaration(declaration_id));

CREATE POLICY "Users delete own exports"
  ON public.declaration_exports FOR DELETE
  USING (auth.uid() = user_id AND public.owns_declaration(declaration_id));

-- Bucket privé pour les PDFs de synthèse
INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-summary-pdfs', 'tax-summary-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage : chemin = {user_id}/{declaration_id}/...
CREATE POLICY "Users read own tax summary pdfs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tax-summary-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own tax summary pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tax-summary-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own tax summary pdfs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tax-summary-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );