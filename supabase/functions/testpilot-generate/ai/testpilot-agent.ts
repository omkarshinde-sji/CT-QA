import type { TestPilotContext, QaReport } from "../types/qa-report.types.ts";
import { chatCompletion } from "../lib/chat-completion.ts";
import { buildPromptMessages } from "./prompt-builder.ts";
import { getQaRelevantPaths } from "./context-builder.ts";
import { sanitizeQaReport } from "./report-sanitizer.ts";
import { enrichReportFromFeedback, getClientFeedbackItems } from "./enrich-report-feedback.ts";
import {
  buildRetryPrompt,
  parseAndValidateQaReport,
  validateFileCoverage,
  validateFeedbackCoverage,
} from "./output-parser.ts";

const MAX_ATTEMPTS = 3;

export class TestPilotAgentError extends Error {
  constructor(
    message: string,
    public readonly validationErrors?: string[],
  ) {
    super(message);
    this.name = "TestPilotAgentError";
  }
}

export interface AgentRunResult {
  report: QaReport;
  model: string;
  tokensUsed: number;
}

function finalizeReport(
  ctx: TestPilotContext,
  report: QaReport,
  allFilePaths: string[],
): QaReport {
  const enriched = enrichReportFromFeedback(ctx, report);
  const feedbackItems = getClientFeedbackItems(ctx);
  return sanitizeQaReport(enriched, allFilePaths, feedbackItems);
}

export async function runTestPilotAgent(ctx: TestPilotContext): Promise<AgentRunResult> {
  const allFilePaths = ctx.pr.changedFiles.map((f) => f.filename);
  const qaRelevantPaths = getQaRelevantPaths(ctx);
  const messages = buildPromptMessages(ctx);
  let lastErrors: string[] = [];
  let totalTokens = 0;
  let modelUsed = "gpt-4o-mini";
  let bestReport: QaReport | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await chatCompletion({
      messages,
      temperature: 0.3,
      max_tokens: 16000,
    });

    totalTokens += (result.input_tokens ?? 0) + (result.output_tokens ?? 0);
    modelUsed = result.model;

    const parsed = parseAndValidateQaReport(result.content);
    if (parsed.success && parsed.report) {
      bestReport = parsed.report;
      const coverageErrors = [
        ...validateFileCoverage(parsed.report, qaRelevantPaths),
        ...validateFeedbackCoverage(ctx, parsed.report),
      ];
      if (!coverageErrors.length) {
        return {
          report: finalizeReport(ctx, parsed.report, allFilePaths),
          model: modelUsed,
          tokensUsed: totalTokens,
        };
      }

      lastErrors = coverageErrors;
      console.warn(`[testpilot-agent] attempt ${attempt} incomplete coverage:`, coverageErrors);

      if (attempt < MAX_ATTEMPTS) {
        messages.push(
          { role: "assistant", content: result.content },
          { role: "user", content: buildRetryPrompt(coverageErrors) },
        );
        continue;
      }
    } else {
      lastErrors = parsed.errors ?? ["Unknown validation error"];
      console.warn(`[testpilot-agent] attempt ${attempt} failed:`, lastErrors);

      if (attempt < MAX_ATTEMPTS) {
        messages.push(
          { role: "assistant", content: result.content },
          { role: "user", content: buildRetryPrompt(lastErrors) },
        );
      }
    }
  }

  if (bestReport) {
    return {
      report: finalizeReport(ctx, bestReport, allFilePaths),
      model: modelUsed,
      tokensUsed: totalTokens,
    };
  }

  throw new TestPilotAgentError(
    `Failed to generate valid QA report after ${MAX_ATTEMPTS} attempts`,
    lastErrors,
  );
}
