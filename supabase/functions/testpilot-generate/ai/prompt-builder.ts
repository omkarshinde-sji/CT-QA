import type { TestPilotContext } from "../types/qa-report.types.ts";
import { getOnboardingContext } from "../services/project-context.service.ts";

export function buildSystemPrompt(): string {
  return `You are a senior QA engineer writing test briefs for manual QA testers who are NOT developers.

Your job: read the GitHub PR diff and explain WHAT CHANGED in plain, simple English — with enough technical detail (file names, APIs, UI screens) that testers know exactly where to look.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "featureSummary": {
    "summary": "One plain-English sentence: what this PR does overall",
    "before": "Overall behavior BEFORE this PR (simple language, required when modifying existing features)",
    "after": "Overall behavior AFTER this PR (simple language, required when modifying existing features)",
    "userFlow": "Step-by-step user flow AFTER the change (for new features only)",
    "changes": [
      {
        "area": "Short name of what changed, e.g. 'MCP Server Connection Dialog'",
        "files": ["exact/file/path.tsx"],
        "before": "What the user/developer saw or how it worked BEFORE (1-3 short sentences, no jargon)",
        "after": "What the user/developer sees or how it works NOW (1-3 short sentences, no jargon)",
        "technicalNote": "Brief technical context: component, API endpoint, edge function, or DB table affected",
        "whatToVerify": "One sentence: the main thing QA should confirm for this change"
      }
    ]
  },
  "requirementBreakdown": [{ "type": "string", "description": "string", "acceptanceCriteria": ["string"] }],
  "positiveTests": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "negativeTests": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "edgeCases": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "impactedModules": [{ "moduleName": "string", "reason": "string", "testingPriority": "High|Medium|Low" }],
  "riskAssessment": [{ "risk": "string", "severity": "Critical|High|Medium|Low", "mitigation": "string" }],
  "regressionChecklist": [{ "category": "string", "items": ["string"] }],
  "onboardingSummary": "string (optional)"
}

WRITING RULES (critical):
1. featureSummary.changes is REQUIRED — one entry per logical change area from the PR diff (minimum 1, typically 2-8).
2. Every "before" and "after" must be concrete and testable — describe visible behavior, not code internals.
   BAD: "Updated the component logic"
   GOOD: "Before: Users had to restart Cursor after adding an MCP server. After: Users toggle the MCP server off and on in Cursor Settings."
3. Use simple words. Avoid: "utilize", "leverage", "implement". Use: "use", "change", "show", "click", "save".
4. technicalNote should name real files, functions, or APIs from the diff — this is the technical layer for QA leads.
5. Test case steps must start with a verb (Open, Click, Enter, Verify) and reference real UI labels or URLs from the diff.
6. impactedModules must use actual file paths from the PR, not invented module names.
7. Only test what this PR touches — do NOT tell QA to regression-test the entire app unless the diff affects shared code.
8. If the PR is docs-only or copy-only, say so clearly in before/after.
9. Group related file changes into one "changes" entry — do not create one entry per file unless each file is unrelated.`;
}

export function buildUserPrompt(ctx: TestPilotContext): string {
  const commentsBlock = ctx.task.comments.length
    ? ctx.task.comments.map((c) => `- [${c.createdAt}] ${c.author}: ${c.body}`).join("\n")
    : "No comments";

  const filesBlock = ctx.pr.changedFiles
    .map((f) => {
      const patch = f.patch ? `\n${f.patch}` : "";
      return `### ${f.status}: ${f.filename}${patch}`;
    })
    .join("\n\n");

  const commitsBlock = ctx.pr.commitMessages.map((m) => `- ${m}`).join("\n");

  const modulesBlock = ctx.project.modules
    .map((m) => `- ${m.name} (${m.id}): ${m.description}`)
    .join("\n");

  const pathHints = ctx.project.pathHints.length
    ? ctx.project.pathHints.join("\n")
    : "No path-based module hints";

  const onboardingBase = getOnboardingContext();

  return `## Feature Information

**Task Title:** ${ctx.task.title}
**Task Status:** ${ctx.task.status}

**Task Description:**
${ctx.task.description ?? "No description"}

**Comments:**
${commentsBlock}

## PR Changes

**PR #${ctx.prNumber}:** ${ctx.pr.title}
**Repository:** ${ctx.repo}
**Head SHA:** ${ctx.pr.headSha}

**PR Description:**
${ctx.pr.body ?? "No PR description"}

**Changed Files Summary:**
${ctx.pr.diffSummary}

**Commit Messages:**
${commitsBlock}

**File Diffs:**
${filesBlock}

## Project Context

**Repository modules:**
${modulesBlock}

**Dependencies:**
${ctx.project.dependencies.join(", ")}

**PR path → module hints:**
${pathHints}

**Onboarding reference:**
${onboardingBase}

## Instructions for this report

Focus on BEFORE vs AFTER for each change area. QA testers need to understand:
- What worked or looked one way before this PR
- What should work or look differently after this PR
- Which files/screens/APIs are involved (technicalNote)
- Exactly what to click and verify (test cases + whatToVerify)`;
}

export function buildPromptMessages(ctx: TestPilotContext) {
  return [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(ctx) },
  ];
}
