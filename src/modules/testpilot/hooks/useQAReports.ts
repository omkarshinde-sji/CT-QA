import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { QaReportWithMeta } from "../types/qa-report.types";

interface QaReportRow {
  id: string;
  task_id: string | null;
  pr_number: number;
  pr_numbers: number[] | null;
  github_repo: string | null;
  feature_summary: QaReportWithMeta["featureSummary"];
  requirements: QaReportWithMeta["requirementBreakdown"];
  positive_tests: QaReportWithMeta["positiveTests"];
  negative_tests: QaReportWithMeta["negativeTests"];
  edge_cases: QaReportWithMeta["edgeCases"];
  impacted_modules: QaReportWithMeta["impactedModules"];
  risk_assessment: QaReportWithMeta["riskAssessment"];
  regression_checklist: QaReportWithMeta["regressionChecklist"];
  onboarding_summary: string | null;
  created_at: string;
}

function mapRow(row: QaReportRow): QaReportWithMeta {
  const prNumbers = row.pr_numbers?.length
    ? [...row.pr_numbers].sort((a, b) => a - b)
    : [row.pr_number];

  return {
    id: row.id,
    taskId: row.task_id,
    prNumber: row.pr_number,
    prNumbers,
    githubRepo: row.github_repo,
    createdAt: row.created_at,
    featureSummary: row.feature_summary,
    requirementBreakdown: row.requirements,
    positiveTests: row.positive_tests,
    negativeTests: row.negative_tests,
    edgeCases: row.edge_cases,
    impactedModules: row.impacted_modules,
    riskAssessment: row.risk_assessment,
    regressionChecklist: row.regression_checklist,
    onboardingSummary: row.onboarding_summary ?? undefined,
  };
}

export interface QAReportsFilter {
  repo?: string;
  prNumbers?: number[];
}

export function useQAReports(filter?: QAReportsFilter) {
  const { user } = useAuth();
  const repo = filter?.repo;
  const prNumbers = filter?.prNumbers ?? [];
  const canFetch = Boolean(user && repo && prNumbers.length > 0);

  return useQuery({
    queryKey: queryKeys.testpilot.reports(undefined, repo, prNumbers.join(",")),
    queryFn: async (): Promise<QaReportWithMeta[]> => {
      const prList = prNumbers.join(",");
      const { data, error } = await supabase
        .from("qa_reports")
        .select("*")
        .eq("github_repo", repo!)
        .or(`pr_number.in.(${prList}),pr_numbers.ov.{${prList}}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data as QaReportRow[]).map(mapRow);
    },
    enabled: canFetch,
    staleTime: cacheConfig.staleTime.long,
    placeholderData: (previous) => previous,
  });
}
