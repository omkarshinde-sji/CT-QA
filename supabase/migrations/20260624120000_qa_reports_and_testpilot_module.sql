-- ============================================================================
-- TestPilot / Spec2Test AI — qa_reports table and module registration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.qa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  pr_number integer NOT NULL,
  github_repo text,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, pr_number, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_qa_reports_task_pr
  ON public.qa_reports (task_id, pr_number);

CREATE INDEX IF NOT EXISTS idx_qa_reports_created_at
  ON public.qa_reports (created_at DESC);

ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read qa_reports"
  ON public.qa_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own qa_reports"
  ON public.qa_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Register testpilot module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'TestPilot AI',
  'testpilot',
  'AI-powered QA intelligence from tasks and GitHub PR changes',
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
