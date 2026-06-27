-- TestPilot: support multiple linked PR numbers per QA report
ALTER TABLE public.qa_reports
  ADD COLUMN IF NOT EXISTS pr_numbers integer[] DEFAULT NULL;

-- Backfill existing rows
UPDATE public.qa_reports
SET pr_numbers = ARRAY[pr_number]
WHERE pr_numbers IS NULL AND pr_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_reports_pr_numbers
  ON public.qa_reports USING GIN (pr_numbers);
