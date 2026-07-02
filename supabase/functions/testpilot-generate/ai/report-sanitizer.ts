import type { QaReport } from "../types/qa-report.types.ts";
import {
  isInfrastructureFile,
  isJunkChangeArea,
  isPlaceholderChange,
  isQaRelevantChangedFile,
} from "../services/qa-relevant-files.ts";
import { normalizeForMatch } from "./client-feedback-parser.ts";

function isClientFeedbackArea(
  area: string,
  feedbackItems: string[],
): boolean {
  const n = normalizeForMatch(area);
  return feedbackItems.some((item) => {
    const ni = normalizeForMatch(item);
    return n === ni || n.includes(ni.slice(0, 50)) || ni.includes(n.slice(0, 50));
  });
}

/** Remove non-QA files, placeholder areas, and infrastructure-only cards from the report. */
export function sanitizeQaReport(
  report: QaReport,
  allFilePaths: string[],
  feedbackItems: string[] = [],
): QaReport {
  const excludedFiles = allFilePaths.filter((f) => !isQaRelevantChangedFile(f));
  const qaRelevantPaths = allFilePaths.filter((f) => isQaRelevantChangedFile(f));

  const rawChanges = report.featureSummary.changes ?? [];
  const cleanedChanges = rawChanges
    .map((change) => {
      const files = (change.files ?? []).filter((f) => isQaRelevantChangedFile(f));
      let technicalNote = change.technicalNote;
      if (technicalNote && isInfrastructureFile(technicalNote)) {
        technicalNote = undefined;
      }
      return { ...change, files, technicalNote };
    })
    .filter((change) => {
      if (isPlaceholderChange(change)) return false;
      if (!change.files?.length) {
        return isClientFeedbackArea(change.area, feedbackItems) && !isPlaceholderChange(change);
      }
      if (isJunkChangeArea(change.area, change.files)) return false;
      return true;
    });

  const excludedNote = excludedFiles.length
    ? `${excludedFiles.length} technical/config file(s) omitted from Changes (migrations, dependencies, CI): ${excludedFiles.slice(0, 8).join(", ")}${excludedFiles.length > 8 ? "…" : ""}.`
    : undefined;

  return {
    ...report,
    featureSummary: {
      ...report.featureSummary,
      changes: cleanedChanges,
      totalChangedFiles: allFilePaths.length,
      qaRelevantFileCount: qaRelevantPaths.length,
      excludedFiles: excludedFiles.length ? excludedFiles : undefined,
    },
    onboardingSummary: excludedNote
      ? [report.onboardingSummary, excludedNote].filter(Boolean).join("\n\n")
      : report.onboardingSummary,
  };
}
