import type { QaReportWithMeta } from "../types/qa-report.types";
import { formatPrNumbersLabel } from "./parsePrNumbers";

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
  const prLabel = formatPrNumbersLabel(report.prNumbers?.length ? report.prNumbers : [report.prNumber]);
  const featureParts = [
    `# QA Report — PR ${prLabel}`,
    "",
    report.githubRepo ? `**Repository:** ${report.githubRepo}` : "",
    report.taskId ? `**Task ID:** ${report.taskId}` : "",
    `**Generated:** ${report.createdAt}`,
    report.cached ? "**Source:** Cached report" : "**Source:** Freshly generated",
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
    changesBlock,
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

export async function exportReportPdf(report: QaReportWithMeta, filename = "qa-report") {
  const prLabel = formatPrNumbersLabel(report.prNumbers?.length ? report.prNumbers : [report.prNumber]);
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
  if (report.githubRepo) addParagraph(`Repository: ${report.githubRepo}`);
  addParagraph(`Generated: ${new Date(report.createdAt).toLocaleString()}`);
  addParagraph(report.cached ? "Source: Cached report" : "Source: Freshly generated");

  const fs = report.featureSummary;
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

  if (report.requirementBreakdown.length) {
    addHeading("Requirements", 13);
    report.requirementBreakdown.forEach((r) => {
      addParagraph(`${r.type}: ${r.description}`, 0);
      r.acceptanceCriteria?.forEach((c) => addParagraph(`• ${c}`, 4));
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

  addTestSection("Positive Test Cases", report.positiveTests);
  addTestSection("Negative Test Cases", report.negativeTests);
  addTestSection("Edge Cases", report.edgeCases);

  if (report.impactedModules.length) {
    addHeading("Impacted Modules", 13);
    report.impactedModules.forEach((m) => {
      addParagraph(`${m.moduleName} (${m.testingPriority}): ${m.reason}`);
    });
  }

  if (report.riskAssessment.length) {
    addHeading("Risk Assessment", 13);
    report.riskAssessment.forEach((r) => {
      addParagraph(`${r.severity}: ${r.risk}`);
      if (r.mitigation) addParagraph(`Mitigation: ${r.mitigation}`, 4);
    });
  }

  if (report.regressionChecklist.length) {
    addHeading("Regression Checklist", 13);
    report.regressionChecklist.forEach((g) => {
      addParagraph(g.category);
      g.items.forEach((item) => addParagraph(`• ${item}`, 4));
    });
  }

  if (report.onboardingSummary) {
    addHeading("Onboarding Summary", 13);
    addParagraph(report.onboardingSummary);
  }

  doc.save(`${filename}.pdf`);
}

export async function exportReportDocx(report: QaReportWithMeta, filename = "qa-report") {
  const prLabel = formatPrNumbersLabel(report.prNumbers?.length ? report.prNumbers : [report.prNumber]);
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

  if (report.githubRepo) children.push(body(`Repository: ${report.githubRepo}`));
  children.push(
    body(`Generated: ${new Date(report.createdAt).toLocaleString()}`),
    body(report.cached ? "Source: Cached report" : "Source: Freshly generated"),
    heading("Overview", HeadingLevel.HEADING_1),
    body(report.featureSummary.summary),
  );

  const fs = report.featureSummary;
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

  if (report.requirementBreakdown.length) {
    children.push(heading("Requirements", HeadingLevel.HEADING_1));
    report.requirementBreakdown.forEach((r) => {
      children.push(body(`${r.type}: ${r.description}`, true));
      r.acceptanceCriteria?.forEach((c) => children.push(bullet(c, 0)));
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

  addTestSection("Positive Test Cases", report.positiveTests);
  addTestSection("Negative Test Cases", report.negativeTests);
  addTestSection("Edge Cases", report.edgeCases);

  if (report.impactedModules.length) {
    children.push(heading("Impacted Modules", HeadingLevel.HEADING_1));
    report.impactedModules.forEach((m) => {
      children.push(body(`${m.moduleName} (${m.testingPriority}): ${m.reason}`));
    });
  }

  if (report.riskAssessment.length) {
    children.push(heading("Risk Assessment", HeadingLevel.HEADING_1));
    report.riskAssessment.forEach((r) => {
      children.push(body(`${r.severity}: ${r.risk}`, true));
      if (r.mitigation) children.push(body(`Mitigation: ${r.mitigation}`));
    });
  }

  if (report.regressionChecklist.length) {
    children.push(heading("Regression Checklist", HeadingLevel.HEADING_1));
    report.regressionChecklist.forEach((g) => {
      children.push(body(g.category, true));
      g.items.forEach((item) => children.push(bullet(item, 0)));
    });
  }

  if (report.onboardingSummary) {
    children.push(
      heading("Onboarding Summary", HeadingLevel.HEADING_1),
      body(report.onboardingSummary),
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}
