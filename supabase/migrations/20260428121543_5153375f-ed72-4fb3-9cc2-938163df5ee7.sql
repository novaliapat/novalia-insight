-- =========================================
-- Novalia Déclaration Impôts - Schéma initial
-- =========================================

-- Enum pour le statut d'une déclaration
CREATE TYPE public.declaration_status AS ENUM (
  'draft',
  'extraction_pending',
  'extraction_done',
  'validation_pending',
  'analysis_pending',
  'finalized'
);

-- Enum pour les rôles applicatifs
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Enum pour les catégories fiscales (alignées sur les bibliothèques RAG)
CREATE TYPE public.tax_category AS ENUM (
  'ifu',
  'scpi',
  'life_insurance',
  'real_estate_income',
  'dividends',
  'interests',
  'capital_gains',
  'foreign_accounts',
  'per',
  'tax_credits',
  'deductible_expenses',
  'other'
);

-- =========================================
-- Table profiles
-- =========================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- =========================================
-- Table user_roles (séparée du profil pour la sécurité)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- =========================================
-- Trigger : créer profil + rôle 'user' à chaque signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- Fonction utilitaire updated_at
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Table declarations
-- =========================================
CREATE TABLE public.declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nouvelle déclaration',
  status declaration_status NOT NULL DEFAULT 'draft',
  tax_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_declarations_user ON public.declarations(user_id, created_at DESC);
ALTER TABLE public.declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own declarations" ON public.declarations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own declarations" ON public.declarations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own declarations" ON public.declarations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own declarations" ON public.declarations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_declarations_updated_at
  BEFORE UPDATE ON public.declarations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Helper : vérifier que l'utilisateur courant possède la déclaration
-- =========================================
CREATE OR REPLACE FUNCTION public.owns_declaration(_declaration_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.declarations
    WHERE id = _declaration_id AND user_id = auth.uid()
  )
$$;

-- =========================================
-- Table declaration_files
-- =========================================
CREATE TABLE public.declaration_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL REFERENCES public.declarations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_declaration_files_decl ON public.declaration_files(declaration_id);
ALTER TABLE public.declaration_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own declaration files" ON public.declaration_files
  FOR SELECT USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users insert own declaration files" ON public.declaration_files
  FOR INSERT WITH CHECK (public.owns_declaration(declaration_id));
CREATE POLICY "Users delete own declaration files" ON public.declaration_files
  FOR DELETE USING (public.owns_declaration(declaration_id));

-- =========================================
-- Table declaration_extracted_data
-- =========================================
CREATE TABLE public.declaration_extracted_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL UNIQUE REFERENCES public.declarations(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(4,3),
  detected_categories tax_category[] NOT NULL DEFAULT ARRAY[]::tax_category[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.declaration_extracted_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own extracted data" ON public.declaration_extracted_data
  FOR SELECT USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users insert own extracted data" ON public.declaration_extracted_data
  FOR INSERT WITH CHECK (public.owns_declaration(declaration_id));
CREATE POLICY "Users update own extracted data" ON public.declaration_extracted_data
  FOR UPDATE USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users delete own extracted data" ON public.declaration_extracted_data
  FOR DELETE USING (public.owns_declaration(declaration_id));

CREATE TRIGGER update_extracted_data_updated_at
  BEFORE UPDATE ON public.declaration_extracted_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Table declaration_validated_data
-- =========================================
CREATE TABLE public.declaration_validated_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL UNIQUE REFERENCES public.declarations(id) ON DELETE CASCADE,
  validated_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.declaration_validated_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own validated data" ON public.declaration_validated_data
  FOR SELECT USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users insert own validated data" ON public.declaration_validated_data
  FOR INSERT WITH CHECK (public.owns_declaration(declaration_id));
CREATE POLICY "Users update own validated data" ON public.declaration_validated_data
  FOR UPDATE USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users delete own validated data" ON public.declaration_validated_data
  FOR DELETE USING (public.owns_declaration(declaration_id));

-- =========================================
-- Table declaration_fiscal_analysis
-- =========================================
CREATE TABLE public.declaration_fiscal_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL UNIQUE REFERENCES public.declarations(id) ON DELETE CASCADE,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.declaration_fiscal_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own analysis" ON public.declaration_fiscal_analysis
  FOR SELECT USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users insert own analysis" ON public.declaration_fiscal_analysis
  FOR INSERT WITH CHECK (public.owns_declaration(declaration_id));
CREATE POLICY "Users update own analysis" ON public.declaration_fiscal_analysis
  FOR UPDATE USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users delete own analysis" ON public.declaration_fiscal_analysis
  FOR DELETE USING (public.owns_declaration(declaration_id));

CREATE TRIGGER update_fiscal_analysis_updated_at
  BEFORE UPDATE ON public.declaration_fiscal_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Table declaration_audit_logs
-- =========================================
CREATE TABLE public.declaration_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id UUID NOT NULL REFERENCES public.declarations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_decl ON public.declaration_audit_logs(declaration_id, created_at DESC);
ALTER TABLE public.declaration_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit logs" ON public.declaration_audit_logs
  FOR SELECT USING (public.owns_declaration(declaration_id));
CREATE POLICY "Users insert own audit logs" ON public.declaration_audit_logs
  FOR INSERT WITH CHECK (public.owns_declaration(declaration_id));

-- =========================================
-- Storage : bucket privé pour les documents fiscaux
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('declaration-files', 'declaration-files', false);

-- Les fichiers sont rangés sous {user_id}/{declaration_id}/{filename}
CREATE POLICY "Users read own declaration files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'declaration-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own declaration files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'declaration-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own declaration files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'declaration-files' AND auth.uid()::text = (storage.foldername(name))[1]);
