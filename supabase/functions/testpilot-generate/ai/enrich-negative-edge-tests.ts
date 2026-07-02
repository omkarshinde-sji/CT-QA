import type { QaReport, TestCase, TestPilotContext } from "../types/qa-report.types.ts";
import { extractClientFeedbackItems } from "./client-feedback-parser.ts";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function screenLabel(ctx: TestPilotContext): string {
  const title = ctx.task.title?.trim();
  if (title) return truncate(title, 80);
  return "the screen described in the ActiveCollab task";
}

function contextBlob(ctx: TestPilotContext, report: QaReport): string {
  const feedback = extractClientFeedbackItems(ctx.task.description, ctx.task.comments);
  const changes = (report.featureSummary.changes ?? []).map((c) => c.area).join(" ");
  const flow = report.featureSummary.userFlow ?? "";
  return `${feedback.join(" ")} ${changes} ${flow} ${ctx.task.title}`.toLowerCase();
}

function hasKeyword(blob: string, pattern: RegExp): boolean {
  return pattern.test(blob);
}

function buildNegativeTests(ctx: TestPilotContext, report: QaReport): TestCase[] {
  const screen = screenLabel(ctx);
  const blob = contextBlob(ctx, report);
  const tests: TestCase[] = [];

  if (hasKeyword(blob, /graph|plot|scatter|chart|trend|line|toggle|clear/i)) {
    tests.push({
      title: "Graph actions with no data loaded",
      steps: [
        `Open ${screen} without entering required inputs or loading pricing data.`,
        "Attempt to use Clear Plot or toggle trend lines on an empty graph.",
        "Observe whether the UI handles the empty state without errors.",
      ],
      expectedResult: "No crash or broken layout; graph controls are disabled or show a clear empty-state message.",
      category: "Negative",
    });
    tests.push({
      title: "Invalid or incomplete input submission",
      steps: [
        `Open ${screen}.`,
        "Leave required numeric fields empty or enter non-numeric values where numbers are expected.",
        "Trigger calculation or plot refresh.",
      ],
      expectedResult: "Validation prevents bad data from breaking results; user sees an error or fields are highlighted.",
      category: "Negative",
    });
  }

  if (hasKeyword(blob, /delta|vega|gamma|analysis|calculation|premium|pricing|notional|shares/i)) {
    tests.push({
      title: "Calculation with invalid numeric inputs",
      steps: [
        `Open ${screen} and navigate to the Analysis or results section.`,
        "Enter negative, zero, or non-numeric values in fields that drive calculations.",
        "Submit or trigger recalculation.",
      ],
      expectedResult: "Results do not show NaN or misleading values; validation or safe defaults are applied.",
      category: "Negative",
    });
  }

  if (hasKeyword(blob, /toggle|button|clear/i)) {
    tests.push({
      title: "Repeated toggle or clear actions",
      steps: [
        `Open ${screen}.`,
        "Use the toggle or Clear control multiple times in quick succession.",
        "Confirm the UI state stays consistent after each action.",
      ],
      expectedResult: "Controls remain responsive; no duplicate overlays, stuck state, or console errors.",
      category: "Negative",
    });
  }

  if (!tests.length) {
    tests.push({
      title: "Required fields left empty",
      steps: [
        `Open ${screen}.`,
        "Submit or proceed without filling required inputs.",
      ],
      expectedResult: "The form blocks submission and shows validation feedback — no silent failure.",
      category: "Negative",
    });
    tests.push({
      title: "Invalid input values",
      steps: [
        `Open ${screen}.`,
        "Enter clearly invalid values (letters in numeric fields, out-of-range numbers).",
        "Attempt to save or calculate.",
      ],
      expectedResult: "Invalid input is rejected with a clear message; existing valid data is not corrupted.",
      category: "Negative",
    });
  }

  return tests;
}

function buildEdgeCaseTests(ctx: TestPilotContext, report: QaReport): TestCase[] {
  const screen = screenLabel(ctx);
  const blob = contextBlob(ctx, report);
  const tests: TestCase[] = [];

  if (hasKeyword(blob, /vega|decimal|format|precision|%/i)) {
    tests.push({
      title: "Decimal and percentage formatting boundaries",
      steps: [
        `Open ${screen} and produce values that require rounding (e.g. Vega to 4 decimals, percentage fields).`,
        "Compare displayed values against expected rounding rules from client feedback.",
      ],
      expectedResult: "Values display with the correct precision and formatting — no extra trailing digits or truncation.",
      category: "Edge case",
    });
  }

  if (hasKeyword(blob, /graph|plot|scatter|volatility|spread|trend|peer|icr|advisor/i)) {
    tests.push({
      title: "Extreme chart input values",
      steps: [
        `Open ${screen} and enter very large and very small values for chart-driving inputs.`,
        "Refresh the plot and inspect axis scaling and line visibility.",
      ],
      expectedResult: "Chart remains readable; lines render correctly without overflow or clipped labels.",
      category: "Edge case",
    });
    tests.push({
      title: "Toggle trend lines across advisor groups",
      steps: [
        `Open ${screen} with data that includes multiple advisor groups (ICR, Other Advisor, No Advisor).`,
        "Toggle trend line visibility on and off; verify each group behaves independently.",
      ],
      expectedResult: "Each group's trend lines show/hide correctly per toggle state.",
      category: "Edge case",
    });
  }

  if (hasKeyword(blob, /notional|shares|75|delta/i)) {
    tests.push({
      title: "Boundary values for notional and share calculations",
      steps: [
        `Open ${screen}.`,
        "Test with zero, minimum, and very large notional/share values referenced in client feedback.",
        "Verify retained delta percentages match expected business rules.",
      ],
      expectedResult: "Calculations handle boundary values without overflow, divide-by-zero, or wrong percentages.",
      category: "Edge case",
    });
  }

  if (!tests.length) {
    tests.push({
      title: "Minimum and maximum input boundaries",
      steps: [
        `Open ${screen}.`,
        "Test the smallest and largest realistic values for the main input fields.",
      ],
      expectedResult: "UI and calculations remain stable at boundary values.",
      category: "Edge case",
    });
    tests.push({
      title: "Page refresh mid-workflow",
      steps: [
        `Open ${screen} and partially complete the main workflow.`,
        "Refresh the browser tab, then continue the flow.",
      ],
      expectedResult: "Page recovers cleanly; no stale state or broken controls after refresh.",
      category: "Edge case",
    });
  }

  return tests;
}

function dedupeTests(tests: TestCase[]): TestCase[] {
  const seen = new Set<string>();
  const out: TestCase[] = [];
  for (const test of tests) {
    const key = test.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(test);
  }
  return out;
}

function minNegativeCount(feedbackCount: number): number {
  return Math.max(2, Math.min(5, feedbackCount > 0 ? Math.ceil(feedbackCount / 2) + 1 : 3));
}

function minEdgeCount(feedbackCount: number): number {
  return Math.max(2, Math.min(4, feedbackCount > 0 ? Math.ceil(feedbackCount / 3) + 1 : 2));
}

/** Fill negativeTests and edgeCases when the AI omits them (common with token limits). */
export function enrichNegativeAndEdgeTests(
  ctx: TestPilotContext,
  report: QaReport,
): QaReport {
  const feedbackCount = extractClientFeedbackItems(ctx.task.description, ctx.task.comments).length;
  const targetNegative = minNegativeCount(feedbackCount);
  const targetEdge = minEdgeCount(feedbackCount);

  let negativeTests = dedupeTests([...report.negativeTests]);
  let edgeCases = dedupeTests([...report.edgeCases]);

  if (negativeTests.length < targetNegative) {
    const generated = buildNegativeTests(ctx, report);
    for (const test of generated) {
      if (negativeTests.length >= targetNegative) break;
      if (!negativeTests.some((t) => t.title.toLowerCase() === test.title.toLowerCase())) {
        negativeTests.push(test);
      }
    }
  }

  if (edgeCases.length < targetEdge) {
    const generated = buildEdgeCaseTests(ctx, report);
    for (const test of generated) {
      if (edgeCases.length >= targetEdge) break;
      if (!edgeCases.some((t) => t.title.toLowerCase() === test.title.toLowerCase())) {
        edgeCases.push(test);
      }
    }
  }

  if (
    negativeTests.length > report.negativeTests.length ||
    edgeCases.length > report.edgeCases.length
  ) {
    console.log(
      `[enrich-negative-edge] ensured tests: negative ${report.negativeTests.length}→${negativeTests.length}, edge ${report.edgeCases.length}→${edgeCases.length}`,
    );
  }

  return { ...report, negativeTests, edgeCases };
}
