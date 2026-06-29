import { QaReportSchema, type QaReport, type TestPilotContext } from "../types/qa-report.types.ts";
import { extractClientFeedbackItems, findUncoveredFeedbackItems } from "./client-feedback-parser.ts";

export interface ParseResult {
  success: boolean;
  report?: QaReport;
  errors?: string[];
  raw?: string;
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) return jsonMatch[0];

  return trimmed;
}

export function parseAndValidateQaReport(content: string): ParseResult {
  try {
    const jsonText = extractJson(content);
    const parsed = JSON.parse(jsonText);
    const result = QaReportSchema.safeParse(parsed);

    if (!result.success) {
      return {
        success: false,
        errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        raw: content,
      };
    }

    return { success: true, report: normalizeReport(result.data) };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Failed to parse JSON"],
      raw: content,
    };
  }
}

function normalizeReport(report: QaReport): QaReport {
  return {
    ...report,
    featureSummary: {
      ...report.featureSummary,
      changes: report.featureSummary.changes ?? [],
    },
    requirementBreakdown: report.requirementBreakdown ?? [],
    positiveTests: report.positiveTests ?? [],
    negativeTests: report.negativeTests ?? [],
    edgeCases: report.edgeCases ?? [],
    impactedModules: report.impactedModules ?? [],
    riskAssessment: report.riskAssessment ?? [],
    regressionChecklist: report.regressionChecklist ?? [],
  };
}

export function buildRetryPrompt(errors: string[]): string {
  return `Your previous response was invalid. Fix these validation errors and return ONLY valid JSON:\n${errors.join("\n")}`;
}

/** Returns error messages when QA-relevant files are missing from changes[].files */
export function validateFileCoverage(
  report: QaReport,
  qaRelevantPaths: string[],
): string[] {
  if (!qaRelevantPaths.length) return [];

  const covered = new Set<string>();
  for (const change of report.featureSummary.changes ?? []) {
    for (const file of change.files ?? []) {
      covered.add(file);
    }
  }

  const missing = qaRelevantPaths.filter((path) => !covered.has(path));
  if (!missing.length) return [];

  return [
    `QA file coverage incomplete: ${missing.length} of ${qaRelevantPaths.length} QA-relevant files missing from changes[].files.`,
    `Missing: ${missing.slice(0, 25).join(", ")}${missing.length > 25 ? ` …and ${missing.length - 25} more` : ""}`,
    "Add change areas for each missing file. Do NOT add package.json, lockfiles, or config-only files.",
  ];
}

/** Returns errors when ActiveCollab client feedback items are not reflected in the report. */
export function validateFeedbackCoverage(
  ctx: TestPilotContext,
  report: QaReport,
): string[] {
  const items = extractClientFeedbackItems(ctx.task.description, ctx.task.comments);
  if (!items.length) return [];

  const missing = findUncoveredFeedbackItems(items, report);
  if (!missing.length) return [];

  return [
    `Client feedback coverage incomplete: ${missing.length} of ${items.length} ActiveCollab items not covered.`,
    `Missing: ${missing.slice(0, 10).join(" | ")}${missing.length > 10 ? ` …and ${missing.length - 10} more` : ""}`,
    `Each item needs BOTH a changes[] entry (area + whatToVerify) AND a positiveTests entry. Include all Analysis sub-items: Retained Delta % Notional, Retained Delta % Shares, Volatility Spread (replaced Bond Gamma), Vega formatted to 4 decimal places.`,
  ];
}
