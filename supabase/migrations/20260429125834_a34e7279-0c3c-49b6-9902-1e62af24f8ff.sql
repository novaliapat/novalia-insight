-- Lot Guide Déclaratif — Étape 1 : table guidance
CREATE TABLE IF NOT EXISTS public.declaration_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid NOT NULL,
  tax_year integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  guidance jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_declaration_guidance_declaration_id
  ON public.declaration_guidance(declaration_id);

ALTER TABLE public.declaration_guidance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own guidance"
  ON public.declaration_guidance FOR SELECT
  USING (public.owns_declaration(declaration_id));

CREATE POLICY "Users insert own guidance"
  ON public.declaration_guidance FOR INSERT
  WITH CHECK (public.owns_declaration(declaration_id));

CREATE POLICY "Users update own guidance"
  ON public.declaration_guidance FOR UPDATE
  USING (public.owns_declaration(declaration_id));

CREATE POLICY "Users delete own guidance"
  ON public.declaration_guidance FOR DELETE
  USING (public.owns_declaration(declaration_id));

CREATE TRIGGER update_declaration_guidance_updated_at
  BEFORE UPDATE ON public.declaration_guidance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();