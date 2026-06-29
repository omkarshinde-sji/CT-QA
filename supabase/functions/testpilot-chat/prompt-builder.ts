import type { QaReport } from "../testpilot-generate/types/qa-report.types.ts";

export interface ChatPromptInput {
  repo: string;
  prNumbers: number[];
  taskTitle?: string;
  taskDescription?: string;
  taskComments?: Array<{ author: string; body: string; createdAt: string }>;
  report?: QaReport;
  prContextBlock?: string;
}

function formatTests(tests: QaReport["positiveTests"]): string {
  if (!tests.length) return "none";
  return tests
    .map((t, i) => {
      const steps = t.steps?.length ? `\n   Steps: ${t.steps.join(" → ")}` : "";
      const expected = t.expectedResult ? `\n   Expected: ${t.expectedResult}` : "";
      return `${i + 1}. ${t.title}${steps}${expected}`;
    })
    .join("\n");
}

export function serializeReportForChat(report: QaReport): string {
  const fs = report.featureSummary;
  const lines: string[] = [
    `Summary: ${fs.summary}`,
  ];
  if (fs.userFlow) lines.push(`User flow:\n${fs.userFlow}`);
  if (fs.before) lines.push(`Overall before: ${fs.before}`);
  if (fs.after) lines.push(`Overall after: ${fs.after}`);

  if (fs.changes?.length) {
    lines.push("\n## Change areas (before vs after)");
    for (const c of fs.changes) {
      lines.push(
        `\n### ${c.area}`,
        `Files: ${(c.files ?? []).join(", ") || "n/a"}`,
        `Before: ${c.before}`,
        `After: ${c.after}`,
        `Verify: ${c.whatToVerify}`,
      );
      if (c.technicalNote) lines.push(`Technical: ${c.technicalNote}`);
    }
  }

  if (report.requirementBreakdown.length) {
    lines.push("\n## Requirements");
    for (const r of report.requirementBreakdown) {
      lines.push(`- [${r.type}] ${r.description}`);
      r.acceptanceCriteria?.forEach((ac) => lines.push(`  • ${ac}`));
    }
  }

  lines.push("\n## Positive tests\n" + formatTests(report.positiveTests));
  lines.push("\n## Negative tests\n" + formatTests(report.negativeTests));
  lines.push("\n## Edge cases\n" + formatTests(report.edgeCases));

  if (report.riskAssessment.length) {
    lines.push("\n## Risks");
    for (const r of report.riskAssessment) {
      lines.push(`- [${r.severity}] ${r.risk}${r.mitigation ? ` — Mitigation: ${r.mitigation}` : ""}`);
    }
  }

  if (report.regressionChecklist.length) {
    lines.push("\n## Regression checklist");
    for (const g of report.regressionChecklist) {
      lines.push(`### ${g.category}`);
      g.items.forEach((item) => lines.push(`- [ ] ${item}`));
    }
  }

  if (report.onboardingSummary) {
    lines.push(`\n## Onboarding\n${report.onboardingSummary}`);
  }

  return lines.join("\n");
}

export function buildChatSystemPrompt(input: ChatPromptInput): string {
  const prLabel = input.prNumbers.map((n) => `#${n}`).join(", ");
  const commentsBlock = input.taskComments?.length
    ? input.taskComments
      .map((c, i) => `Comment ${i + 1} (${c.author}, ${c.createdAt}):\n${c.body}`)
      .join("\n\n")
    : "No task comments.";

  const reportBlock = input.report
    ? serializeReportForChat(input.report)
    : input.prContextBlock
    ? `No QA report generated yet. Use PR technical context below.\n\n${input.prContextBlock}`
    : "No QA report or PR diff available.";

  return `You are TestPilot QA Assistant — a helpful copilot for manual QA testers.

SCOPE (strict):
- You may ONLY answer questions about GitHub PR ${prLabel} in repository ${input.repo}, the QA report below, ActiveCollab task context, and what QA should verify.
- If the user asks about anything outside this PR/report (other features, general coding, unrelated repos), reply: "I can only answer questions about the selected PR(s) and QA report. Try asking about changes, test cases, risks, or before/after behavior."
- Do NOT invent files, test cases, or behaviors that are not in the context below. If unsure, say what is missing and suggest generating a full QA report.

Repository: ${input.repo}
PR(s): ${prLabel}
Task title: ${input.taskTitle || "Not linked"}

Task description (context only — client feedback bullets are in comments):
${input.taskDescription || "None"}

ActiveCollab comments:
${commentsBlock}

---
QA REPORT & TEST CONTEXT:
${reportBlock}
---

Answer in clear, plain English for a non-developer QA tester. Use bullet lists when listing test cases or changes. Quote exact labels from the report when relevant (e.g. section names, button names).`;
}
