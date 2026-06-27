import { z } from "https://esm.sh/zod@3.25.76";

export const TestingPrioritySchema = z.enum(["High", "Medium", "Low"]);
export const RiskSeveritySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const TestCaseSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  steps: z.array(z.string()).optional(),
  expectedResult: z.string().optional(),
  category: z.string().optional(),
});

export const ChangeItemSchema = z.object({
  area: z.string(),
  files: z.array(z.string()).optional(),
  before: z.string(),
  after: z.string(),
  technicalNote: z.string().optional(),
  whatToVerify: z.string(),
});

export const FeatureSummarySchema = z.object({
  summary: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  userFlow: z.string().optional(),
  changes: z.array(ChangeItemSchema).optional(),
});

export const RequirementItemSchema = z.object({
  type: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

export const ImpactedModuleSchema = z.object({
  moduleName: z.string(),
  reason: z.string(),
  testingPriority: TestingPrioritySchema,
});

export const RiskItemSchema = z.object({
  risk: z.string(),
  severity: RiskSeveritySchema,
  mitigation: z.string().optional(),
});

export const RegressionGroupSchema = z.object({
  category: z.string(),
  items: z.array(z.string()),
});

export const QaReportSchema = z.object({
  featureSummary: FeatureSummarySchema,
  requirementBreakdown: z.array(RequirementItemSchema),
  positiveTests: z.array(TestCaseSchema),
  negativeTests: z.array(TestCaseSchema),
  edgeCases: z.array(TestCaseSchema),
  impactedModules: z.array(ImpactedModuleSchema),
  riskAssessment: z.array(RiskItemSchema),
  regressionChecklist: z.array(RegressionGroupSchema),
  onboardingSummary: z.string().optional(),
});

const TaskCommentInputSchema = z.object({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const GenerateRequestSchema = z.object({
  prNumbers: z.array(z.number().int().positive()).min(1).max(10).optional(),
  /** @deprecated use prNumbers */
  prNumber: z.number().int().positive().optional(),
  regenerate: z.boolean().optional(),
  repo: z.string().min(1),
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
  taskComments: z.array(TaskCommentInputSchema).optional(),
  activeCollabProjectId: z.number().int().positive().optional(),
  activeCollabTaskId: z.number().int().positive().optional(),
}).refine(
  (data) => (data.prNumbers?.length ?? 0) > 0 || data.prNumber != null,
  { message: "At least one PR number is required (prNumbers or prNumber)" },
);

export function resolvePrNumbers(request: z.infer<typeof GenerateRequestSchema>): number[] {
  const raw = request.prNumbers?.length
    ? request.prNumbers
    : request.prNumber != null
    ? [request.prNumber]
    : [];
  const unique = [...new Set(raw.filter((n) => Number.isFinite(n) && n > 0))];
  unique.sort((a, b) => a - b);
  return unique;
}

export type TestCase = z.infer<typeof TestCaseSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
export type RequirementItem = z.infer<typeof RequirementItemSchema>;
export type ImpactedModule = z.infer<typeof ImpactedModuleSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type RegressionGroup = z.infer<typeof RegressionGroupSchema>;
export type QaReport = z.infer<typeof QaReportSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export interface TestPilotContext {
  /** Internal Control Tower task UUID (tasks table). Never set for ActiveCollab-only context. */
  taskId: string | null;
  activeCollabTaskId: number | null;
  activeCollabProjectId: number | null;
  /** Primary PR (lowest number) — used for DB pr_number column */
  prNumber: number;
  /** All linked PR numbers, sorted ascending */
  prNumbers: number[];
  repo: string;
  contextHash: string;
  prs: Array<{
    prNumber: number;
    title: string;
    body: string | null;
    headSha: string;
    diffSummary: string;
    commitMessages: string[];
    changedFiles: Array<{ filename: string; status: string; patch?: string }>;
  }>;
  task: {
    title: string;
    description: string | null;
    status: string;
    comments: Array<{ author: string; body: string; createdAt: string }>;
  };
  /** Merged view across all linked PRs */
  pr: {
    title: string;
    body: string | null;
    changedFiles: Array<{ filename: string; status: string; patch?: string }>;
    commitMessages: string[];
    diffSummary: string;
    headSha: string;
  };
  project: {
    modules: Array<{ id: string; name: string; description: string }>;
    dependencies: string[];
    pathHints: string[];
    impactedModulesFromPaths: Array<{ moduleName: string; files: string[] }>;
  };
}

export interface QaReportRecord {
  id: string;
  task_id: string | null;
  pr_number: number;
  pr_numbers: number[] | null;
  github_repo: string | null;
  context_hash: string;
  feature_summary: FeatureSummary;
  requirements: RequirementItem[];
  positive_tests: TestCase[];
  negative_tests: TestCase[];
  edge_cases: TestCase[];
  impacted_modules: ImpactedModule[];
  risk_assessment: RiskItem[];
  regression_checklist: RegressionGroup[];
  onboarding_summary: string | null;
  model_used: string | null;
  tokens_used: number | null;
  created_by: string | null;
  created_at: string;
}

export function recordToReport(
  record: QaReportRecord,
): QaReport & {
  id: string;
  taskId: string | null;
  prNumber: number;
  prNumbers: number[];
  githubRepo?: string | null;
  createdAt: string;
} {
  const prNumbers = record.pr_numbers?.length
    ? [...record.pr_numbers].sort((a, b) => a - b)
    : [record.pr_number];

  return {
    id: record.id,
    taskId: record.task_id,
    githubRepo: record.github_repo,
    prNumber: record.pr_number,
    prNumbers,
    createdAt: record.created_at,
    featureSummary: record.feature_summary,
    requirementBreakdown: record.requirements,
    positiveTests: record.positive_tests,
    negativeTests: record.negative_tests,
    edgeCases: record.edge_cases,
    impactedModules: record.impacted_modules,
    riskAssessment: record.risk_assessment,
    regressionChecklist: record.regression_checklist,
    onboardingSummary: record.onboarding_summary ?? undefined,
  };
}
