import { z } from "zod";

export const TestingPrioritySchema = z.enum(["High", "Medium", "Low"]);
export const RiskSeveritySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const TestCaseSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  steps: z.array(z.string()).optional(),
  expectedResult: z.string().optional(),
  category: z.string().optional(),
});

export const FeatureSummarySchema = z.object({
  summary: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  userFlow: z.string().optional(),
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

export type TestCase = z.infer<typeof TestCaseSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
export type RequirementItem = z.infer<typeof RequirementItemSchema>;
export type ImpactedModule = z.infer<typeof ImpactedModuleSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type RegressionGroup = z.infer<typeof RegressionGroupSchema>;
export type QaReport = z.infer<typeof QaReportSchema>;

export interface QaReportWithMeta extends QaReport {
  id: string;
  taskId: string;
  prNumber: number;
  githubRepo?: string | null;
  createdAt: string;
  cached?: boolean;
}

export interface GenerateTestPilotRequest {
  taskId: string;
  prNumber: number;
  regenerate?: boolean;
  repo?: string;
}

export interface GenerateTestPilotResponse {
  success: boolean;
  report: QaReportWithMeta;
  cached: boolean;
}
