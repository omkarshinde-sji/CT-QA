import type { QaReport, TaskCommentInput } from "../types/qa-report.types";
import {
  dedupeChangesByFeedback,
  dedupePositiveTestsByFeedback,
  dedupeRequirementsByFeedback,
  extractClientFeedbackItems,
  hasDedicatedChangeArea,
  hasDedicatedPositiveTest,
} from "./clientFeedbackParser";
import { isQaRelevantChangedFile } from "./qaRelevantFiles";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function collectQaFilePaths(report: QaReport): string[] {
  const fromChanges = (report.featureSummary.changes ?? []).flatMap((c) => c.files ?? []);
  return [...new Set(fromChanges.filter((f) => isQaRelevantChangedFile(f)))];
}

function guessRelatedFiles(item: string, qaFiles: string[]): string[] {
  if (!qaFiles.length) return [];
  const lower = item.toLowerCase();
  const keywords: Array<[RegExp, string[]]> = [
    [/graph|plot|scatter|trend|dotted|line|volatility spread|sk10|basis point|peer|icr|toggle|clear/i, [
      "chart", "graph", "plot", "scatter", "visual",
    ]],
    [/analysis|delta|gamma|vega|greek|premium|pricing|borrow|notional|shares|75/i, [
      "result", "calculation", "analysis", "greek", "premium", "pricing", "delta", "vega",
    ]],
    [/button|clear|toggle/i, ["button", "plot", "graph", "toggle"]],
  ];
  for (const [pattern, hints] of keywords) {
    if (!pattern.test(lower)) continue;
    const matched = qaFiles.filter((f) => hints.some((h) => f.toLowerCase().includes(h)));
    if (matched.length) return matched.slice(0, 4);
  }
  return qaFiles.slice(0, 2);
}

export function enrichReportFromFeedback(
  report: QaReport,
  taskDescription: string,
  taskComments: TaskCommentInput[],
): QaReport {
  const feedbackItems = extractClientFeedbackItems(taskDescription, taskComments);
  if (!feedbackItems.length) return report;

  const qaFiles = collectQaFilePaths(report);
  let changes = [...(report.featureSummary.changes ?? [])];
  let positiveTests = [...report.positiveTests];
  let requirementBreakdown = [...report.requirementBreakdown];
  const regressionChecklist = [...report.regressionChecklist];

  let clientGroup = regressionChecklist.find((g) => g.category === "Client feedback");
  if (!clientGroup) {
    clientGroup = { category: "Client feedback", items: [] };
    regressionChecklist.push(clientGroup);
  }
  const regressionItems = new Set(clientGroup.items);

  for (const item of feedbackItems) {
    const files = guessRelatedFiles(item, qaFiles);
    const needsChange = !hasDedicatedChangeArea(item, changes);
    const needsTest = !hasDedicatedPositiveTest(item, positiveTests);

    if (needsChange) {
      changes.push({
        area: truncate(item, 120),
        files,
        before: "Behavior before this client feedback was implemented.",
        after: item,
        technicalNote: files.length ? files.join(", ") : "See PR diff for related files.",
        whatToVerify: `Confirm: ${item}`,
      });
    }
    if (needsTest) {
      positiveTests.push({
        title: `Verify client feedback: ${truncate(item, 90)}`,
        steps: [
          "Log in and open the Call Spread Pricer (or screen named in the ActiveCollab task).",
          `Navigate to the section described in client feedback: ${truncate(item, 150)}.`,
          "Compare the on-screen labels, values, and formatting to the client requirement.",
          "Record a screenshot if behavior matches the expected client feedback.",
        ],
        expectedResult: item,
        category: "Functional",
      });
    }
    if (needsChange || needsTest) {
      requirementBreakdown.push({
        type: "Client feedback",
        description: item,
        acceptanceCriteria: [item],
      });
      regressionItems.add(item);
    }
  }

  changes = dedupeChangesByFeedback(changes, feedbackItems);
  positiveTests = dedupePositiveTestsByFeedback(positiveTests, feedbackItems);
  requirementBreakdown = dedupeRequirementsByFeedback(requirementBreakdown, feedbackItems);

  clientGroup.items = [...regressionItems];

  return {
    ...report,
    featureSummary: { ...report.featureSummary, changes },
    positiveTests,
    requirementBreakdown,
    regressionChecklist,
  };
}
