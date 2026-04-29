-- =========================================================
-- LOT 3 — RAG fiscal cloisonné par catégorie
-- =========================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- tax_rag_documents ----------
CREATE TABLE public.tax_rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category public.tax_category NOT NULL,
  tax_year integer,
  source_type text NOT NULL,
  source_name text,
  source_url text,
  document_date date,
  is_official_source boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  storage_path text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rag_documents_category ON public.tax_rag_documents(category);
CREATE INDEX idx_tax_rag_documents_uploader ON public.tax_rag_documents(uploaded_by);
CREATE INDEX idx_tax_rag_documents_official ON public.tax_rag_documents(is_official_source);

ALTER TABLE public.tax_rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read official RAG docs"
  ON public.tax_rag_documents FOR SELECT
  TO authenticated
  USING (is_official_source = true OR uploaded_by = auth.uid());

CREATE POLICY "Users insert own RAG docs"
  ON public.tax_rag_documents FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users update own RAG docs"
  ON public.tax_rag_documents FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users delete own RAG docs"
  ON public.tax_rag_documents FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE TRIGGER trg_tax_rag_documents_updated_at
  BEFORE UPDATE ON public.tax_rag_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- tax_rag_chunks ----------
CREATE TABLE public.tax_rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.tax_rag_documents(id) ON DELETE CASCADE,
  category public.tax_category NOT NULL,
  tax_year integer,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  summary text,
  keywords text[] NOT NULL DEFAULT '{}',
  embedding vector(384),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rag_chunks_document ON public.tax_rag_chunks(document_id);
CREATE INDEX idx_tax_rag_chunks_category ON public.tax_rag_chunks(category);
CREATE INDEX idx_tax_rag_chunks_embedding
  ON public.tax_rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE public.tax_rag_chunks ENABLE ROW LEVEL SECURITY;

-- Chunks visibility follows document visibility
CREATE POLICY "Read chunks of visible RAG docs"
  ON public.tax_rag_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tax_rag_documents d
      WHERE d.id = document_id
        AND (d.is_official_source = true OR d.uploaded_by = auth.uid())
    )
  );

CREATE POLICY "Insert chunks for own RAG docs"
  ON public.tax_rag_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tax_rag_documents d
      WHERE d.id = document_id AND d.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Delete chunks of own RAG docs"
  ON public.tax_rag_chunks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tax_rag_documents d
      WHERE d.id = document_id AND d.uploaded_by = auth.uid()
    )
  );

-- ---------- tax_rag_queries ----------
CREATE TABLE public.tax_rag_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid REFERENCES public.declarations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  category public.tax_category NOT NULL,
  query text NOT NULL,
  retrieved_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  top_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rag_queries_user ON public.tax_rag_queries(user_id);
CREATE INDEX idx_tax_rag_queries_declaration ON public.tax_rag_queries(declaration_id);

ALTER TABLE public.tax_rag_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own RAG queries"
  ON public.tax_rag_queries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own RAG queries"
  ON public.tax_rag_queries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------- tax_rag_sources_used ----------
CREATE TABLE public.tax_rag_sources_used (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid REFERENCES public.declarations(id) ON DELETE CASCADE,
  analysis_id uuid,
  category public.tax_category NOT NULL,
  document_id uuid REFERENCES public.tax_rag_documents(id) ON DELETE SET NULL,
  chunk_id uuid REFERENCES public.tax_rag_chunks(id) ON DELETE SET NULL,
  relevance_score numeric,
  used_in_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rag_sources_used_declaration ON public.tax_rag_sources_used(declaration_id);

ALTER TABLE public.tax_rag_sources_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view sources used"
  ON public.tax_rag_sources_used FOR SELECT
  TO authenticated
  USING (declaration_id IS NULL OR public.owns_declaration(declaration_id));

CREATE POLICY "Owners insert sources used"
  ON public.tax_rag_sources_used FOR INSERT
  TO authenticated
  WITH CHECK (declaration_id IS NULL OR public.owns_declaration(declaration_id));

-- ---------- match_tax_rag_chunks RPC ----------
CREATE OR REPLACE FUNCTION public.match_tax_rag_chunks(
  query_embedding vector(384),
  match_category public.tax_category,
  match_tax_year integer DEFAULT NULL,
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  summary text,
  keywords text[],
  title text,
  category public.tax_category,
  tax_year integer,
  source_name text,
  source_url text,
  is_official_source boolean,
  document_date date,
  similarity numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id            AS chunk_id,
    c.document_id   AS document_id,
    c.content,
    c.summary,
    c.keywords,
    d.title,
    c.category,
    c.tax_year,
    d.source_name,
    d.source_url,
    d.is_official_source,
    d.document_date,
    (1 - (c.embedding <=> query_embedding))::numeric AS similarity
  FROM public.tax_rag_chunks c
  JOIN public.tax_rag_documents d ON d.id = c.document_id
  WHERE c.category = match_category
    AND d.status = 'active'
    AND (
      match_tax_year IS NULL
      OR c.tax_year IS NULL
      OR c.tax_year = match_tax_year
    )
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1)
$$;