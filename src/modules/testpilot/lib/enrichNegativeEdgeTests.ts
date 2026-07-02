import type { QaReport, TaskCommentInput, TestCase } from "../types/qa-report.types";
import { extractClientFeedbackItems } from "./clientFeedbackParser";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function screenLabel(taskTitle: string | undefined): string {
  if (taskTitle?.trim()) return truncate(taskTitle.trim(), 80);
  return "the screen described in the ActiveCollab task";
}

function contextBlob(
  taskTitle: string,
  taskDescription: string,
  taskComments: TaskCommentInput[],
  report: QaReport,
): string {
  const feedback = extractClientFeedbackItems(taskDescription, taskComments);
  const changes = (report.featureSummary.changes ?? []).map((c) => c.area).join(" ");
  const flow = report.featureSummary.userFlow ?? "";
  return `${feedback.join(" ")} ${changes} ${flow} ${taskTitle}`.toLowerCase();
}

function hasKeyword(blob: string, pattern: RegExp): boolean {
  return pattern.test(blob);
}

function buildNegativeTests(
  taskTitle: string,
  blob: string,
): TestCase[] {
  const screen = screenLabel(taskTitle);
  const tests: TestCase[] = [];

  if (hasKeyword(blob, /graph|plot|scatter|chart|trend|line|toggle|clear/i)) {
    tests.push({
      title: "Graph actions with no data loaded",
      steps: [
        `Open ${screen} without entering required inputs or loading pricing data.`,
        "Attempt to use Clear Plot or toggle trend lines on an empty graph.",
      ],
      expectedResult: "No crash; controls are disabled or show a clear empty-state message.",
      category: "Negative",
    });
    tests.push({
      title: "Invalid or incomplete input submission",
      steps: [
        `Open ${screen}.`,
        "Leave required fields empty or enter non-numeric values.",
        "Trigger calculation or plot refresh.",
      ],
      expectedResult: "Validation prevents bad data; user sees an error or field highlight.",
      category: "Negative",
    });
  }

  if (hasKeyword(blob, /delta|vega|gamma|analysis|calculation|premium|pricing|notional|shares/i)) {
    tests.push({
      title: "Calculation with invalid numeric inputs",
      steps: [
        `Open ${screen} and navigate to the Analysis or results section.`,
        "Enter negative, zero, or non-numeric values.",
        "Trigger recalculation.",
      ],
      expectedResult: "No NaN or misleading values; validation or safe defaults apply.",
      category: "Negative",
    });
  }

  if (!tests.length) {
    tests.push({
      title: "Required fields left empty",
      steps: [`Open ${screen}.`, "Submit without filling required inputs."],
      expectedResult: "Form blocks submission with validation feedback.",
      category: "Negative",
    });
    tests.push({
      title: "Invalid input values",
      steps: [`Open ${screen}.`, "Enter invalid values and attempt to save or calculate."],
      expectedResult: "Invalid input is rejected with a clear message.",
      category: "Negative",
    });
  }

  return tests;
}

function buildEdgeCaseTests(taskTitle: string, blob: string): TestCase[] {
  const screen = screenLabel(taskTitle);
  const tests: TestCase[] = [];

  if (hasKeyword(blob, /vega|decimal|format|precision|%/i)) {
    tests.push({
      title: "Decimal and percentage formatting boundaries",
      steps: [
        `Open ${screen} and produce values requiring rounding (e.g. Vega to 4 decimals).`,
        "Compare displayed values against expected formatting.",
      ],
      expectedResult: "Values display with correct precision — no extra trailing digits.",
      category: "Edge case",
    });
  }

  if (hasKeyword(blob, /graph|plot|scatter|volatility|spread|trend|peer|icr|advisor/i)) {
    tests.push({
      title: "Extreme chart input values",
      steps: [
        `Open ${screen} and enter very large and very small chart inputs.`,
        "Refresh the plot and inspect scaling.",
      ],
      expectedResult: "Chart remains readable without overflow or clipped labels.",
      category: "Edge case",
    });
    tests.push({
      title: "Toggle trend lines across advisor groups",
      steps: [
        `Open ${screen} with multiple advisor groups visible.`,
        "Toggle trend line visibility on and off for each group.",
      ],
      expectedResult: "Each group's trend lines show/hide correctly per toggle state.",
      category: "Edge case",
    });
  }

  if (!tests.length) {
    tests.push({
      title: "Minimum and maximum input boundaries",
      steps: [`Open ${screen}.`, "Test smallest and largest realistic input values."],
      expectedResult: "UI and calculations remain stable at boundary values.",
      category: "Edge case",
    });
    tests.push({
      title: "Page refresh mid-workflow",
      steps: [`Open ${screen}, partially complete the workflow, then refresh the browser.`],
      expectedResult: "Page recovers cleanly with no broken controls.",
      category: "Edge case",
    });
  }

  return tests;
}

function dedupeTests(tests: TestCase[]): TestCase[] {
  const seen = new Set<string>();
  return tests.filter((test) => {
    const key = test.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function enrichNegativeAndEdgeTests(
  report: QaReport,
  taskTitle = "",
  taskDescription = "",
  taskComments: TaskCommentInput[] = [],
): QaReport {
  const feedbackCount = extractClientFeedbackItems(taskDescription, taskComments).length;
  const targetNegative = Math.max(2, Math.min(5, feedbackCount > 0 ? Math.ceil(feedbackCount / 2) + 1 : 3));
  const targetEdge = Math.max(2, Math.min(4, feedbackCount > 0 ? Math.ceil(feedbackCount / 3) + 1 : 2));
  const blob = contextBlob(taskTitle, taskDescription, taskComments, report);

  let negativeTests = dedupeTests([...report.negativeTests]);
  let edgeCases = dedupeTests([...report.edgeCases]);

  if (negativeTests.length < targetNegative) {
    for (const test of buildNegativeTests(taskTitle, blob)) {
      if (negativeTests.length >= targetNegative) break;
      if (!negativeTests.some((t) => t.title.toLowerCase() === test.title.toLowerCase())) {
        negativeTests.push(test);
      }
    }
  }

  if (edgeCases.length < targetEdge) {
    for (const test of buildEdgeCaseTests(taskTitle, blob)) {
      if (edgeCases.length >= targetEdge) break;
      if (!edgeCases.some((t) => t.title.toLowerCase() === test.title.toLowerCase())) {
        edgeCases.push(test);
      }
    }
  }

  return { ...report, negativeTests, edgeCases };
}
