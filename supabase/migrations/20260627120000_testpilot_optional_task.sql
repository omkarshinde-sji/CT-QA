-- TestPilot: make task_id optional; cache by repo + PR + context hash

ALTER TABLE public.qa_reports DROP CONSTRAINT IF EXISTS qa_reports_task_id_fkey;

ALTER TABLE public.qa_reports ALTER COLUMN task_id DROP NOT NULL;

ALTER TABLE public.qa_reports
  ADD CONSTRAINT qa_reports_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

ALTER TABLE public.qa_reports DROP CONSTRAINT IF EXISTS qa_reports_task_id_pr_number_context_hash_key;
ALTER TABLE public.qa_reports DROP CONSTRAINT IF EXISTS qa_reports_repo_pr_hash_unique;

UPDATE public.qa_reports SET github_repo = '' WHERE github_repo IS NULL;

ALTER TABLE public.qa_reports ALTER COLUMN github_repo SET NOT NULL;
ALTER TABLE public.qa_reports ALTER COLUMN github_repo SET DEFAULT '';

ALTER TABLE public.qa_reports
  ADD CONSTRAINT qa_reports_repo_pr_hash_unique UNIQUE (github_repo, pr_number, context_hash);

CREATE INDEX IF NOT EXISTS idx_qa_reports_repo_pr
  ON public.qa_reports (github_repo, pr_number);
