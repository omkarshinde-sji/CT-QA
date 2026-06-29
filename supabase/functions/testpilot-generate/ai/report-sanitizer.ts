import type { QaReport } from "../types/qa-report.types.ts";
import { isJunkChangeArea, isQaRelevantChangedFile } from "../services/qa-relevant-files.ts";
import { hasDedicatedChangeArea, normalizeForMatch } from "./client-feedback-parser.ts";

function guessFilesForArea(area: string, qaPaths: string[]): string[] {
  const lower = area.toLowerCase();
  const hints: string[] = [];
  if (/graph|plot|trend|line|scatter|volatility|peer|icr|toggle|clear/i.test(lower)) {
    hints.push("chart", "graph", "plot", "scatter", "visual");
  }
  if (/analysis|delta|gamma|vega|greek|premium|pricing|borrow|notional|vega/i.test(lower)) {
    hints.push("result", "calculation", "analysis", "greek", "premium", "pricing", "delta", "vega");
  }
  if (hints.length) {
    const matched = qaPaths.filter((f) =>
      hints.some((h) => f.toLowerCase().includes(h))
    );
    if (matched.length) return matched.slice(0, 3);
  }
  return qaPaths.slice(0, 2);
}

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

/** Remove non-QA files and junk areas (package.json updates, etc.) from the report. */
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
      let files = (change.files ?? []).filter((f) => isQaRelevantChangedFile(f));
      if (!files.length && qaRelevantPaths.length) {
        files = guessFilesForArea(change.area, qaRelevantPaths);
        if (!files.length) files = [qaRelevantPaths[0]];
      }
      return { ...change, files };
    })
    .filter((change) => {
      if (!change.files?.length) {
        return isClientFeedbackArea(change.area, feedbackItems);
      }
      if (isJunkChangeArea(change.area, change.files)) return false;
      return true;
    });

  const covered = new Set(cleanedChanges.flatMap((c) => c.files ?? []));
  const missingQaFiles = qaRelevantPaths.filter((f) => !covered.has(f));

  let changes = cleanedChanges;
  if (missingQaFiles.length) {
    for (const file of missingQaFiles) {
      const label = file.split("/").pop()?.replace(/\.(tsx?|jsx?)$/i, "") ?? file;
      const alreadyCovered = changes.some((c) =>
        hasDedicatedChangeArea(`Update: ${label}`, [c])
      );
      if (alreadyCovered) continue;
      changes.push({
        area: `Update: ${label}`,
        files: [file],
        before: "Previous behavior before this PR.",
        after: "Updated per PR diff — verify against ActiveCollab client feedback.",
        technicalNote: file,
        whatToVerify: `Confirm ${label} works as described in the client task.`,
      });
    }
  }

  const excludedNote = excludedFiles.length
    ? `${excludedFiles.length} non-QA file(s) omitted from changes (dependencies/config): ${excludedFiles.slice(0, 8).join(", ")}${excludedFiles.length > 8 ? "…" : ""}.`
    : undefined;

  return {
    ...report,
    featureSummary: {
      ...report.featureSummary,
      changes,
      totalChangedFiles: allFilePaths.length,
      qaRelevantFileCount: qaRelevantPaths.length,
      excludedFiles: excludedFiles.length ? excludedFiles : undefined,
    },
    onboardingSummary: excludedNote
      ? [report.onboardingSummary, excludedNote].filter(Boolean).join("\n\n")
      : report.onboardingSummary,
  };
}
