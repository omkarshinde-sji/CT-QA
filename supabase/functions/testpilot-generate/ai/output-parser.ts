import { QaReportSchema, type QaReport } from "../types/qa-report.types.ts";

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
