import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type GenerateRequest,
  type QaReport,
  type QaReportRecord,
  recordToReport,
} from "../types/qa-report.types.ts";
import { buildTestPilotContext } from "../ai/context-builder.ts";
import { runTestPilotAgent } from "../ai/testpilot-agent.ts";

export interface GenerateQaReportResult {
  success: boolean;
  report: ReturnType<typeof recordToReport>;
  cached: boolean;
}

export async function getCachedReport(
  supabase: SupabaseClient,
  repo: string,
  prNumber: number,
  contextHash: string,
): Promise<QaReportRecord | null> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select("*")
    .eq("github_repo", repo)
    .eq("pr_number", prNumber)
    .eq("context_hash", contextHash)
    .maybeSingle();

  if (error) {
    console.error("[qa-generation] cache lookup failed:", error.message);
    return null;
  }

  return data as QaReportRecord | null;
}

async function saveReport(
  supabase: SupabaseClient,
  input: {
    taskId: string | null;
    prNumber: number;
    repo: string;
    contextHash: string;
    report: QaReport;
    modelUsed: string;
    tokensUsed: number;
    userId: string;
  },
): Promise<QaReportRecord> {
  const row = {
    task_id: input.taskId,
    pr_number: input.prNumber,
    github_repo: input.repo,
    context_hash: input.contextHash,
    feature_summary: input.report.featureSummary,
    requirements: input.report.requirementBreakdown,
    positive_tests: input.report.positiveTests,
    negative_tests: input.report.negativeTests,
    edge_cases: input.report.edgeCases,
    impacted_modules: input.report.impactedModules,
    risk_assessment: input.report.riskAssessment,
    regression_checklist: input.report.regressionChecklist,
    onboarding_summary: input.report.onboardingSummary ?? null,
    model_used: input.modelUsed,
    tokens_used: input.tokensUsed,
    created_by: input.userId,
  };

  const { data, error } = await supabase
    .from("qa_reports")
    .upsert(row, { onConflict: "github_repo,pr_number,context_hash" })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to save QA report: ${error.message}`);
  return data as QaReportRecord;
}

export async function generateQaReport(
  supabase: SupabaseClient,
  request: GenerateRequest,
  userId: string,
): Promise<GenerateQaReportResult> {
  const ctx = await buildTestPilotContext({
    prNumber: request.prNumber,
    repo: request.repo,
    taskTitle: request.taskTitle,
    taskDescription: request.taskDescription,
  });

  if (!request.regenerate) {
    const cached = await getCachedReport(
      supabase,
      ctx.repo,
      request.prNumber,
      ctx.contextHash,
    );
    if (cached) {
      return {
        success: true,
        report: recordToReport(cached),
        cached: true,
      };
    }
  }

  const agentResult = await runTestPilotAgent(ctx);
  const saved = await saveReport(supabase, {
    taskId: ctx.taskId,
    prNumber: request.prNumber,
    repo: ctx.repo,
    contextHash: ctx.contextHash,
    report: agentResult.report,
    modelUsed: agentResult.model,
    tokensUsed: agentResult.tokensUsed,
    userId,
  });

  return {
    success: true,
    report: recordToReport(saved),
    cached: false,
  };
}
