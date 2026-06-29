import type { QaReportWithMeta } from "../types/qa-report.types";
import { formatPrNumbersLabel } from "./parsePrNumbers";
import { prepareReportForDisplay, type PrepareReportOptions } from "./prepareReportForDisplay";

function prepareExportReport(
  report: QaReportWithMeta,
  options?: PrepareReportOptions,
): QaReportWithMeta {
  return { ...report, ...prepareReportForDisplay(report, options) };
}

function downloadBlob(blob: Blob, filename: string) {
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

function downloadText(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function exportReportJson(
  report: QaReportWithMeta,
  filename = "qa-report",
  prepare?: PrepareReportOptions,
) {
  downloadText(JSON.stringify(prepareExportReport(report, prepare), null, 2), `${filename}.json`, "application/json");
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

export function reportToMarkdown(report: QaReportWithMeta, prepare?: PrepareReportOptions): string {
  const r = prepareExportReport(report, prepare);
  const fs = r.featureSummary;
  const prLabel = formatPrNumbersLabel(r.prNumbers?.length ? r.prNumbers : [r.prNumber]);
  const featureParts = [
    `# QA Report — PR ${prLabel}`,
    "",
    r.githubRepo ? `**Repository:** ${r.githubRepo}` : "",
    r.taskId ? `**Task ID:** ${r.taskId}` : "",
    `**Generated:** ${r.createdAt}`,
    r.cached ? "**Source:** Cached report" : "**Source:** Freshly generated",
    "",
    "## Feature Summary",
    fs.summary,
  ];

  if (fs.before) featureParts.push("", "**Before:**", fs.before);
  if (fs.after) featureParts.push("", "**After:**", fs.after);
  if (fs.userFlow) featureParts.push("", "**User Flow:**", fs.userFlow);

  const changesBlock = fs.changes?.length
    ? [
        "## What Changed — Before vs After",
        ...fs.changes.flatMap((c) => [
          "",
          `### ${c.area}`,
          ...(c.files?.length ? [`**Files:** ${c.files.join(", ")}`] : []),
          "",
          "**Before:**",
          c.before,
          "",
          "**After:**",
          c.after,
          ...(c.technicalNote ? ["", "**Technical note:**", c.technicalNote] : []),
          "",
          `**Verify:** ${c.whatToVerify}`,
        ]),
      ].join("\n")
    : "";

  const requirements = r.requirementBreakdown.length
    ? [
        "## Requirements",
        ...r.requirementBreakdown.map(
          (req) =>
            `- **${req.type}:** ${req.description}${
              req.acceptanceCriteria?.length
                ? `\n  - Acceptance: ${req.acceptanceCriteria.join("; ")}`
                : ""
            }`,
        ),
      ].join("\n")
    : "## Requirements\n\n_No items_";

  const modules = r.impactedModules.length
    ? [
        "## Impacted Modules",
        ...r.impactedModules.map(
          (m) => `- **${m.moduleName}** (${m.testingPriority}): ${m.reason}`,
        ),
      ].join("\n")
    : "## Impacted Modules\n\n_No items_";

  const risks = r.riskAssessment.length
    ? [
        "## Risk Assessment",
        ...r.riskAssessment.map(
          (risk) =>
            `- **${risk.severity}:** ${risk.risk}${risk.mitigation ? ` — Mitigation: ${risk.mitigation}` : ""}`,
        ),
      ].join("\n")
    : "## Risk Assessment\n\n_No items_";

  const regression = r.regressionChecklist.length
    ? [
        "## Regression Checklist",
        ...r.regressionChecklist.map(
          (g) => `### ${g.category}\n${g.items.map((i) => `- ${i}`).join("\n")}`,
        ),
      ].join("\n\n")
    : "## Regression Checklist\n\n_No items_";

  return [
    ...featureParts,
    "",
    changesBlock,
    "",
    requirements,
    "",
    formatTestCases("Positive Test Cases", r.positiveTests),
    "",
    formatTestCases("Negative Test Cases", r.negativeTests),
    "",
    formatTestCases("Edge Cases", r.edgeCases),
    "",
    modules,
    "",
    risks,
    "",
    regression,
    "",
    r.onboardingSummary ? `## Onboarding Summary\n\n${r.onboardingSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function exportReportMarkdown(
  report: QaReportWithMeta,
  filename = "qa-report",
  prepare?: PrepareReportOptions,
) {
  downloadText(reportToMarkdown(report, prepare), `${filename}.md`, "text/markdown");
}

export async function copyReportToClipboard(
  report: QaReportWithMeta,
  prepare?: PrepareReportOptions,
) {
  await navigator.clipboard.writeText(reportToMarkdown(report, prepare));
}

export async function exportReportPdf(
  report: QaReportWithMeta,
  filename = "qa-report",
  prepare?: PrepareReportOptions,
) {
  const rep = prepareExportReport(report, prepare);
  const prLabel = formatPrNumbersLabel(rep.prNumbers?.length ? rep.prNumbers : [rep.prNumber]);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lineHeight = 5.5;

  const ensureSpace = (needed = lineHeight) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addHeading = (text: string, size = 14) => {
    ensureSpace(lineHeight * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      ensureSpace();
      doc.text(line, margin, y);
      y += lineHeight + 1;
    });
    y += 2;
  };

  const addParagraph = (text: string, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    lines.forEach((line: string) => {
      ensureSpace();
      doc.text(line, margin + indent, y);
      y += lineHeight;
    });
    y += 2;
  };

  addHeading(`QA Report — PR ${prLabel}`, 16);
  if (rep.githubRepo) addParagraph(`Repository: ${rep.githubRepo}`);
  addParagraph(`Generated: ${new Date(rep.createdAt).toLocaleString()}`);
  addParagraph(rep.cached ? "Source: Cached report" : "Source: Freshly generated");

  const fs = rep.featureSummary;
  addHeading("Overview", 13);
  addParagraph(fs.summary);
  if (fs.userFlow) {
    addParagraph("User Flow:");
    addParagraph(fs.userFlow, 4);
  }

  if (fs.changes?.length) {
    addHeading("What Changed — Before vs After", 13);
    fs.changes.forEach((c) => {
      addParagraph(c.area, 0);
      if (c.files?.length) addParagraph(`Files: ${c.files.join(", ")}`, 4);
      addParagraph("Before:", 0);
      addParagraph(c.before, 4);
      addParagraph("After:", 0);
      addParagraph(c.after, 4);
      if (c.technicalNote) {
        addParagraph("Technical note:", 0);
        addParagraph(c.technicalNote, 4);
      }
      addParagraph(`Verify: ${c.whatToVerify}`, 0);
    });
  } else {
    if (fs.before) {
      addParagraph("Before:");
      addParagraph(fs.before, 4);
    }
    if (fs.after) {
      addParagraph("After:");
      addParagraph(fs.after, 4);
    }
  }

  if (rep.requirementBreakdown.length) {
    addHeading("Requirements", 13);
    rep.requirementBreakdown.forEach((req) => {
      addParagraph(`${req.type}: ${req.description}`, 0);
      req.acceptanceCriteria?.forEach((c) => addParagraph(`• ${c}`, 4));
    });
  }

  const addTestSection = (title: string, cases: QaReportWithMeta["positiveTests"]) => {
    addHeading(title, 13);
    if (!cases.length) {
      addParagraph("No test cases generated.");
      return;
    }
    cases.forEach((tc, i) => {
      addParagraph(`${i + 1}. ${tc.title}`, 0);
      tc.steps?.forEach((step, si) => addParagraph(`${si + 1}. ${step}`, 6));
      if (tc.expectedResult) addParagraph(`Expected: ${tc.expectedResult}`, 4);
    });
  };

  addTestSection("Positive Test Cases", rep.positiveTests);
  addTestSection("Negative Test Cases", rep.negativeTests);
  addTestSection("Edge Cases", rep.edgeCases);

  if (rep.impactedModules.length) {
    addHeading("Impacted Modules", 13);
    rep.impactedModules.forEach((m) => {
      addParagraph(`${m.moduleName} (${m.testingPriority}): ${m.reason}`);
    });
  }

  if (rep.riskAssessment.length) {
    addHeading("Risk Assessment", 13);
    rep.riskAssessment.forEach((risk) => {
      addParagraph(`${risk.severity}: ${risk.risk}`);
      if (risk.mitigation) addParagraph(`Mitigation: ${risk.mitigation}`, 4);
    });
  }

  if (rep.regressionChecklist.length) {
    addHeading("Regression Checklist", 13);
    rep.regressionChecklist.forEach((g) => {
      addParagraph(g.category);
      g.items.forEach((item) => addParagraph(`• ${item}`, 4));
    });
  }

  if (rep.onboardingSummary) {
    addHeading("Onboarding Summary", 13);
    addParagraph(rep.onboardingSummary);
  }

  doc.save(`${filename}.pdf`);
}

export async function exportReportDocx(
  report: QaReportWithMeta,
  filename = "qa-report",
  prepare?: PrepareReportOptions,
) {
  const rep = prepareExportReport(report, prepare);
  const prLabel = formatPrNumbersLabel(rep.prNumbers?.length ? rep.prNumbers : [rep.prNumber]);
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
  } = await import("docx");

  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    new Paragraph({ text, heading: level, spacing: { after: 120 } });

  const body = (text: string, bold = false) =>
    new Paragraph({
      children: [new TextRun({ text, bold })],
      spacing: { after: 100 },
    });

  const bullet = (text: string, level = 0) =>
    new Paragraph({
      text,
      bullet: { level },
      spacing: { after: 80 },
    });

  const children: InstanceType<typeof Paragraph>[] = [
    heading(`QA Report — PR ${prLabel}`, HeadingLevel.TITLE),
  ];

  if (rep.githubRepo) children.push(body(`Repository: ${rep.githubRepo}`));
  children.push(
    body(`Generated: ${new Date(rep.createdAt).toLocaleString()}`),
    body(rep.cached ? "Source: Cached report" : "Source: Freshly generated"),
    heading("Overview", HeadingLevel.HEADING_1),
    body(rep.featureSummary.summary),
  );

  const fs = rep.featureSummary;
  if (fs.userFlow) {
    children.push(body("User Flow:", true), body(fs.userFlow));
  }

  if (fs.changes?.length) {
    children.push(heading("What Changed — Before vs After", HeadingLevel.HEADING_1));
    fs.changes.forEach((c) => {
      children.push(body(c.area, true));
      if (c.files?.length) children.push(body(`Files: ${c.files.join(", ")}`));
      children.push(body("Before:", true), body(c.before));
      children.push(body("After:", true), body(c.after));
      if (c.technicalNote) children.push(body("Technical note:", true), body(c.technicalNote));
      children.push(body(`Verify: ${c.whatToVerify}`, true));
    });
  } else {
    if (fs.before) children.push(body("Before:", true), body(fs.before));
    if (fs.after) children.push(body("After:", true), body(fs.after));
  }

  if (rep.requirementBreakdown.length) {
    children.push(heading("Requirements", HeadingLevel.HEADING_1));
    rep.requirementBreakdown.forEach((req) => {
      children.push(body(`${req.type}: ${req.description}`, true));
      req.acceptanceCriteria?.forEach((c) => children.push(bullet(c, 0)));
    });
  }

  const addTestSection = (title: string, cases: QaReportWithMeta["positiveTests"]) => {
    children.push(heading(title, HeadingLevel.HEADING_1));
    if (!cases.length) {
      children.push(body("No test cases generated."));
      return;
    }
    cases.forEach((tc, i) => {
      children.push(body(`${i + 1}. ${tc.title}`, true));
      tc.steps?.forEach((step, si) => children.push(bullet(`${si + 1}. ${step}`, 0)));
      if (tc.expectedResult) children.push(body(`Expected: ${tc.expectedResult}`));
    });
  };

  addTestSection("Positive Test Cases", rep.positiveTests);
  addTestSection("Negative Test Cases", rep.negativeTests);
  addTestSection("Edge Cases", rep.edgeCases);

  if (rep.impactedModules.length) {
    children.push(heading("Impacted Modules", HeadingLevel.HEADING_1));
    rep.impactedModules.forEach((m) => {
      children.push(body(`${m.moduleName} (${m.testingPriority}): ${m.reason}`));
    });
  }

  if (rep.riskAssessment.length) {
    children.push(heading("Risk Assessment", HeadingLevel.HEADING_1));
    rep.riskAssessment.forEach((risk) => {
      children.push(body(`${risk.severity}: ${risk.risk}`, true));
      if (risk.mitigation) children.push(body(`Mitigation: ${risk.mitigation}`));
    });
  }

  if (rep.regressionChecklist.length) {
    children.push(heading("Regression Checklist", HeadingLevel.HEADING_1));
    rep.regressionChecklist.forEach((g) => {
      children.push(body(g.category, true));
      g.items.forEach((item) => children.push(bullet(item, 0)));
    });
  }

  if (rep.onboardingSummary) {
    children.push(
      heading("Onboarding Summary", HeadingLevel.HEADING_1),
      body(rep.onboardingSummary),
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}
