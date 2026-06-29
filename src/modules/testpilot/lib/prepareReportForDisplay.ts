import type { QaReport, TaskCommentInput } from "../types/qa-report.types";
import { extractClientFeedbackItems, normalizeForMatch } from "./clientFeedbackParser";
import { enrichReportFromFeedback } from "./enrichReportFeedback";
import { isJunkChangeArea, isQaRelevantChangedFile, sanitizeReportForDisplay } from "./qaRelevantFiles";

export interface PrepareReportOptions {
  taskDescription?: string;
  taskComments?: TaskCommentInput[];
}

/** Full pipeline: parse AC feedback → fill gaps → sanitize for display. */
export function prepareReportForDisplay(
  report: QaReport,
  options: PrepareReportOptions = {},
): QaReport {
  const description = options.taskDescription ?? "";
  const comments = options.taskComments ?? [];
  const feedbackItems = extractClientFeedbackItems(description, comments);

  const enriched = enrichReportFromFeedback(report, description, comments);
  const withFiles = ensureChangeAreaFiles(enriched, feedbackItems);
  return sanitizeReportForDisplay(withFiles, feedbackItems);
}

function guessFilesForArea(area: string, qaPaths: string[]): string[] {
  const lower = area.toLowerCase();
  const hints: string[] = [];
  if (/graph|plot|trend|line|scatter|volatility|peer|icr|toggle|clear/i.test(lower)) {
    hints.push("chart", "graph", "plot", "scatter", "visual");
  }
  if (/analysis|delta|gamma|vega|greek|premium|pricing|borrow|notional|shares/i.test(lower)) {
    hints.push("result", "calculation", "analysis", "greek", "premium", "pricing", "delta", "vega");
  }
  if (hints.length) {
    const matched = qaPaths.filter((f) => hints.some((h) => f.toLowerCase().includes(h)));
    if (matched.length) return matched.slice(0, 3);
  }
  return qaPaths.slice(0, 2);
}

function isClientFeedbackArea(area: string, feedbackItems: string[]): boolean {
  const n = normalizeForMatch(area);
  return feedbackItems.some((item) => {
    const ni = normalizeForMatch(item);
    return n === ni || n.includes(ni.slice(0, 50)) || ni.includes(n.slice(0, 50));
  });
}

function ensureChangeAreaFiles(report: QaReport, feedbackItems: string[]): QaReport {
  const qaPaths = [
    ...new Set(
      (report.featureSummary.changes ?? [])
        .flatMap((c) => c.files ?? [])
        .filter((f) => isQaRelevantChangedFile(f)),
    ),
  ];

  if (!qaPaths.length) return report;

  const changes = (report.featureSummary.changes ?? []).map((change) => {
    let files = (change.files ?? []).filter((f) => isQaRelevantChangedFile(f));
    if (!files.length) {
      files = guessFilesForArea(change.area, qaPaths);
      if (!files.length && isClientFeedbackArea(change.area, feedbackItems)) {
        files = [qaPaths[0]];
      }
    }
    return { ...change, files };
  });

  return {
    ...report,
    featureSummary: { ...report.featureSummary, changes },
  };
}
