import type { QaReport, TestPilotContext } from "../types/qa-report.types.ts";
import {
  dedupeChangesByFeedback,
  dedupePositiveTestsByFeedback,
  dedupeRequirementsByFeedback,
  extractClientFeedbackItems,
  hasDedicatedChangeArea,
  hasDedicatedPositiveTest,
} from "./client-feedback-parser.ts";
import { getQaRelevantPaths } from "./context-builder.ts";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function guessRelatedFiles(item: string, ctx: TestPilotContext): string[] {
  const lower = item.toLowerCase();
  const qaFiles = getQaRelevantPaths(ctx);
  if (!qaFiles.length) return [];

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
    const matched = qaFiles.filter((f) =>
      hints.some((h) => f.toLowerCase().includes(h))
    );
    if (matched.length) return matched.slice(0, 4);
  }

  return qaFiles.slice(0, 2);
}

function buildPositiveTest(item: string): QaReport["positiveTests"][number] {
  const short = truncate(item, 90);
  return {
    title: `Verify client feedback: ${short}`,
    steps: [
      "Log in and open the Call Spread Pricer (or screen named in the ActiveCollab task).",
      `Navigate to the section described in client feedback: ${truncate(item, 150)}.`,
      "Compare the on-screen labels, values, and formatting to the client requirement.",
      "Record a screenshot if behavior matches the expected client feedback.",
    ],
    expectedResult: item,
    category: "Functional",
  };
}

function buildChangeArea(item: string, files: string[]): NonNullable<QaReport["featureSummary"]["changes"]>[number] {
  return {
    area: truncate(item, 120),
    files,
    before: "Behavior before this client feedback was implemented.",
    after: item,
    technicalNote: files.length ? files.join(", ") : "See PR diff for related files.",
    whatToVerify: `Confirm: ${item}`,
  };
}

/** Ensure every comment bullet has one change + test; collapse AI/user-story duplicates. */
export function enrichReportFromFeedback(ctx: TestPilotContext, report: QaReport): QaReport {
  const feedbackItems = extractClientFeedbackItems(ctx.task.description, ctx.task.comments);
  if (!feedbackItems.length) return report;

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

  let addedChanges = 0;
  let addedTests = 0;

  for (const item of feedbackItems) {
    const files = guessRelatedFiles(item, ctx);
    const needsChange = !hasDedicatedChangeArea(item, changes);
    const needsTest = !hasDedicatedPositiveTest(item, positiveTests);

    if (needsChange) {
      changes.push(buildChangeArea(item, files));
      addedChanges++;
    }
    if (needsTest) {
      positiveTests.push(buildPositiveTest(item));
      addedTests++;
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

  if (addedChanges || addedTests) {
    console.log(
      `[enrich-feedback] ensured coverage: +${addedChanges} changes, +${addedTests} tests (${feedbackItems.length} comment items, ${changes.length} areas after dedupe)`,
    );
  }

  clientGroup.items = [...regressionItems];

  return {
    ...report,
    featureSummary: {
      ...report.featureSummary,
      changes,
    },
    positiveTests,
    requirementBreakdown,
    regressionChecklist,
  };
}

export function getClientFeedbackItems(ctx: TestPilotContext): string[] {
  return extractClientFeedbackItems(ctx.task.description, ctx.task.comments);
}
