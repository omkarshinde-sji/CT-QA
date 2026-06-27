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

export const GenerateRequestSchema = z.object({
  prNumber: z.number().int().positive(),
  regenerate: z.boolean().optional(),
  repo: z.string().min(1),
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
export type RequirementItem = z.infer<typeof RequirementItemSchema>;
export type ImpactedModule = z.infer<typeof ImpactedModuleSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type RegressionGroup = z.infer<typeof RegressionGroupSchema>;
export type QaReport = z.infer<typeof QaReportSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export interface TestPilotContext {
  taskId: string | null;
  prNumber: number;
  repo: string;
  contextHash: string;
  task: {
    title: string;
    description: string | null;
    status: string;
    comments: Array<{ author: string; body: string; createdAt: string }>;
  };
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
  githubRepo?: string | null;
  createdAt: string;
} {
  return {
    id: record.id,
    taskId: record.task_id,
    githubRepo: record.github_repo,
    prNumber: record.pr_number,
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
