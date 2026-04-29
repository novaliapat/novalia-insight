-- Table pour les points de revue rapide générés depuis l'audit d'extraction
CREATE TABLE public.declaration_review_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL,
  audit_log_id UUID NULL,
  source_type TEXT NOT NULL,
  source_code TEXT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  field TEXT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NULL,
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour requêtes par déclaration
CREATE INDEX idx_review_items_declaration ON public.declaration_review_items(declaration_id);
CREATE INDEX idx_review_items_status ON public.declaration_review_items(declaration_id, status);

-- Anti-doublons : un même point (même clé) ne peut exister qu'une fois par déclaration
CREATE UNIQUE INDEX idx_review_items_dedup ON public.declaration_review_items(declaration_id, dedup_key);

-- Contraintes de valeurs
ALTER TABLE public.declaration_review_items
  ADD CONSTRAINT review_items_status_check CHECK (status IN ('pending', 'resolved', 'ignored')),
  ADD CONSTRAINT review_items_severity_check CHECK (severity IN ('info', 'warning', 'error')),
  ADD CONSTRAINT review_items_source_type_check CHECK (source_type IN ('consistency_issue', 'warning', 'missing_data'));

-- RLS
ALTER TABLE public.declaration_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own review items"
ON public.declaration_review_items FOR SELECT
USING (public.owns_declaration(declaration_id));

CREATE POLICY "Users insert own review items"
ON public.declaration_review_items FOR INSERT
WITH CHECK (public.owns_declaration(declaration_id));

CREATE POLICY "Users update own review items"
ON public.declaration_review_items FOR UPDATE
USING (public.owns_declaration(declaration_id));

CREATE POLICY "Users delete own review items"
ON public.declaration_review_items FOR DELETE
USING (public.owns_declaration(declaration_id));

-- Trigger pour updated_at
CREATE TRIGGER update_review_items_updated_at
BEFORE UPDATE ON public.declaration_review_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();