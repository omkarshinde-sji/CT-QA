import type { TestPilotContext } from "../types/qa-report.types.ts";
import { getOnboardingContext } from "../services/project-context.service.ts";

export function buildSystemPrompt(): string {
  return `You are a senior QA engineer writing test briefs for manual QA testers who are NOT developers.

Your job: read the GitHub PR diff(s) and explain WHAT CHANGED in plain, simple English — with enough technical detail (file names, APIs, UI screens) that testers know exactly where to look.

When multiple PRs are linked, treat them as one combined feature delivery — merge overlapping changes, note which PR introduced which area, and do not duplicate test cases.

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
7. Only test what the linked PR(s) touch — do NOT tell QA to regression-test the entire app unless the diff affects shared code.
8. If the PR is docs-only or copy-only, say so clearly in before/after.
9. Group related file changes into one "changes" entry — do not create one entry per file unless each file is unrelated.
10. When multiple PRs are linked, mention PR numbers in technicalNote when a change is specific to one PR.`;
}

function buildPrSections(ctx: TestPilotContext): string {
  if (ctx.prs.length <= 1) {
    const pr = ctx.prs[0];
    const filesBlock = pr.changedFiles
      .map((f) => {
        const patch = f.patch ? `\n${f.patch}` : "";
        return `### ${f.status}: ${f.filename}${patch}`;
      })
      .join("\n\n");
    const commitsBlock = pr.commitMessages.map((m) => `- ${m}`).join("\n");

    return `**PR #${pr.prNumber}:** ${pr.title}
**Head SHA:** ${pr.headSha}

**PR Description:**
${pr.body ?? "No PR description"}

**Changed Files Summary:**
${pr.diffSummary}

**Commit Messages:**
${commitsBlock}

**File Diffs:**
${filesBlock}`;
  }

  const perPr = ctx.prs
    .map((pr) => {
      const commitsBlock = pr.commitMessages.map((m) => `- ${m}`).join("\n");
      return `### PR #${pr.prNumber}: ${pr.title}
**Head SHA:** ${pr.headSha}
**Description:** ${pr.body ?? "No PR description"}

**Files in this PR:**
${pr.diffSummary}

**Commits:**
${commitsBlock}`;
    })
    .join("\n\n");

  const mergedFilesBlock = ctx.pr.changedFiles
    .map((f) => {
      const patch = f.patch ? `\n${f.patch}` : "";
      return `### ${f.status}: ${f.filename}${patch}`;
    })
    .join("\n\n");

  return `**Linked PRs:** ${ctx.prNumbers.map((n) => `#${n}`).join(", ")} (${ctx.prs.length} total)

${perPr}

---

## Combined file diffs (deduplicated across all PRs)

${mergedFilesBlock}`;
}

export function buildUserPrompt(ctx: TestPilotContext): string {
  const commentsBlock = ctx.task.comments.length
    ? ctx.task.comments.map((c) => `- [${c.createdAt}] ${c.author}: ${c.body}`).join("\n")
    : "No comments";

  const modulesBlock = ctx.project.modules
    .map((m) => `- ${m.name} (${m.id}): ${m.description}`)
    .join("\n");

  const pathHints = ctx.project.pathHints.length
    ? ctx.project.pathHints.join("\n")
    : "No path-based module hints";

  const onboardingBase = getOnboardingContext();
  const prBlock = buildPrSections(ctx);

  return `## Feature Information

**Task Title:** ${ctx.task.title}
**Task Status:** ${ctx.task.status}${
    ctx.activeCollabTaskId
      ? `\n**ActiveCollab Task ID:** ${ctx.activeCollabTaskId}${
          ctx.activeCollabProjectId ? ` (Project ${ctx.activeCollabProjectId})` : ""
        }`
      : ""
  }

**Task Description:**
${ctx.task.description ?? "No description"}

**Task Comments (from ActiveCollab / manual context):**
${commentsBlock}

## PR Changes

**Repository:** ${ctx.repo}

${prBlock}

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

Focus on BEFORE vs AFTER for each change area across ALL linked PRs. QA testers need to understand:
- What worked or looked one way before these PRs
- What should work or look differently after these PRs
- Which files/screens/APIs are involved (technicalNote)
- Exactly what to click and verify (test cases + whatToVerify)`;
}

export function buildPromptMessages(ctx: TestPilotContext) {
  return [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(ctx) },
  ];
}
