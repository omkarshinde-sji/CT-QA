import type { QaReportWithMeta } from "../types/qa-report.types";

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportJson(report: QaReportWithMeta, filename = "qa-report") {
  downloadText(JSON.stringify(report, null, 2), `${filename}.json`, "application/json");
}

function formatTestCases(title: string, cases: QaReportWithMeta["positiveTests"]) {
  if (!cases.length) return `## ${title}\n\n_No items_\n`;
  return [
    `## ${title}`,
    ...cases.map((tc, i) => {
      const steps = tc.steps?.length ? `\n  Steps:\n${tc.steps.map((s) => `  - ${s}`).join("\n")}` : "";
      const expected = tc.expectedResult ? `\n  Expected: ${tc.expectedResult}` : "";
      return `### ${i + 1}. ${tc.title}${steps}${expected}`;
    }),
  ].join("\n\n");
}

export function reportToMarkdown(report: QaReportWithMeta): string {
  const fs = report.featureSummary;
  const featureParts = [
    `# QA Report — PR #${report.prNumber}`,
    "",
    `**Task ID:** ${report.taskId}`,
    `**Generated:** ${report.createdAt}`,
    report.cached ? "**Source:** Cached report" : "**Source:** Freshly generated",
    "",
    "## Feature Summary",
    fs.summary,
  ];

  if (fs.before) featureParts.push("", "**Before:**", fs.before);
  if (fs.after) featureParts.push("", "**After:**", fs.after);
  if (fs.userFlow) featureParts.push("", "**User Flow:**", fs.userFlow);

  const requirements = report.requirementBreakdown.length
    ? [
        "## Requirements",
        ...report.requirementBreakdown.map(
          (r) =>
            `- **${r.type}:** ${r.description}${
              r.acceptanceCriteria?.length
                ? `\n  - Acceptance: ${r.acceptanceCriteria.join("; ")}`
                : ""
            }`,
        ),
      ].join("\n")
    : "## Requirements\n\n_No items_";

  const modules = report.impactedModules.length
    ? [
        "## Impacted Modules",
        ...report.impactedModules.map(
          (m) => `- **${m.moduleName}** (${m.testingPriority}): ${m.reason}`,
        ),
      ].join("\n")
    : "## Impacted Modules\n\n_No items_";

  const risks = report.riskAssessment.length
    ? [
        "## Risk Assessment",
        ...report.riskAssessment.map(
          (r) =>
            `- **${r.severity}:** ${r.risk}${r.mitigation ? ` — Mitigation: ${r.mitigation}` : ""}`,
        ),
      ].join("\n")
    : "## Risk Assessment\n\n_No items_";

  const regression = report.regressionChecklist.length
    ? [
        "## Regression Checklist",
        ...report.regressionChecklist.map(
          (g) => `### ${g.category}\n${g.items.map((i) => `- ${i}`).join("\n")}`,
        ),
      ].join("\n\n")
    : "## Regression Checklist\n\n_No items_";

  return [
    ...featureParts,
    "",
    requirements,
    "",
    formatTestCases("Positive Test Cases", report.positiveTests),
    "",
    formatTestCases("Negative Test Cases", report.negativeTests),
    "",
    formatTestCases("Edge Cases", report.edgeCases),
    "",
    modules,
    "",
    risks,
    "",
    regression,
    "",
    report.onboardingSummary ? `## Onboarding Summary\n\n${report.onboardingSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function exportReportMarkdown(report: QaReportWithMeta, filename = "qa-report") {
  downloadText(reportToMarkdown(report), `${filename}.md`, "text/markdown");
}

export async function copyReportToClipboard(report: QaReportWithMeta) {
  await navigator.clipboard.writeText(reportToMarkdown(report));
}
