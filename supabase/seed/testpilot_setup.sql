-- ============================================================================
-- TestPilot — run this ONCE in Supabase Dashboard → SQL Editor
-- Creates qa_reports (final schema) + module registration + permissions
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible
-- ============================================================================

-- 1. qa_reports table (task_id optional, cache by repo + PR + hash)
CREATE TABLE IF NOT EXISTS public.qa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  pr_number integer NOT NULL,
  github_repo text NOT NULL DEFAULT '',
  context_hash text NOT NULL,
  feature_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  positive_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  edge_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  impacted_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_assessment jsonb NOT NULL DEFAULT '[]'::jsonb,
  regression_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  onboarding_summary text,
  model_used text,
  tokens_used integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade path if an older qa_reports table already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qa_reports' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.qa_reports ALTER COLUMN task_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qa_reports' AND column_name = 'github_repo'
  ) THEN
    UPDATE public.qa_reports SET github_repo = '' WHERE github_repo IS NULL;
    ALTER TABLE public.qa_reports ALTER COLUMN github_repo SET DEFAULT '';
    ALTER TABLE public.qa_reports ALTER COLUMN github_repo SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.qa_reports DROP CONSTRAINT IF EXISTS qa_reports_task_id_pr_number_context_hash_key;
ALTER TABLE public.qa_reports DROP CONSTRAINT IF EXISTS qa_reports_repo_pr_hash_unique;

ALTER TABLE public.qa_reports
  ADD CONSTRAINT qa_reports_repo_pr_hash_unique
  UNIQUE (github_repo, pr_number, context_hash);

CREATE INDEX IF NOT EXISTS idx_qa_reports_task_pr
  ON public.qa_reports (task_id, pr_number);

CREATE INDEX IF NOT EXISTS idx_qa_reports_created_at
  ON public.qa_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_reports_repo_pr
  ON public.qa_reports (github_repo, pr_number);

ALTER TABLE public.qa_reports
  ADD COLUMN IF NOT EXISTS pr_numbers integer[] DEFAULT NULL;

UPDATE public.qa_reports
SET pr_numbers = ARRAY[pr_number]
WHERE pr_numbers IS NULL AND pr_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_reports_pr_numbers
  ON public.qa_reports USING GIN (pr_numbers);

ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read qa_reports" ON public.qa_reports;
CREATE POLICY "Authenticated users can read qa_reports"
  ON public.qa_reports
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert own qa_reports" ON public.qa_reports;
CREATE POLICY "Authenticated users can insert own qa_reports"
  ON public.qa_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 2. Register testpilot module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'TestPilot AI',
  'testpilot',
  'AI-powered QA intelligence from GitHub PR changes',
  'FlaskConical',
  'operations',
  false,
  true,
  10,
  '{platform,actions}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  dependencies = EXCLUDED.dependencies;

INSERT INTO public.app_config (key, value, category, description)
VALUES ('features.enableTestPilot', 'true', 'features', 'Enable TestPilot AI QA intelligence module')
ON CONFLICT (key) DO NOTHING;

-- 3. Grant testpilot to users who already have module permissions
INSERT INTO public.user_module_permissions (user_id, module_id)
SELECT DISTINCT ump.user_id, am.id
FROM public.user_module_permissions ump
CROSS JOIN public.app_modules am
WHERE am.slug = 'testpilot'
ON CONFLICT (user_id, module_id) DO NOTHING;
