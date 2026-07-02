import type { TestPilotContext } from "../types/qa-report.types.ts";
import { getOnboardingContext } from "../services/project-context.service.ts";
import { getQaRelevantPaths } from "./context-builder.ts";
import { isInfrastructureFile } from "../services/qa-relevant-files.ts";
import {
  extractClientFeedbackItems,
  formatFeedbackChecklist,
} from "./client-feedback-parser.ts";

export function buildSystemPrompt(): string {
  return `You are a senior QA engineer writing test briefs for manual QA testers who are NOT developers.

You receive TWO sources — use BOTH:
1. **ActiveCollab client task** (title, description, comments) — PRIMARY for what QA must verify and acceptance criteria
2. **GitHub PR diff** — PRIMARY for before/after technical detail, file paths, and UI/API behavior

When multiple PRs are linked, treat them as one combined feature delivery.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "featureSummary": {
    "summary": "One plain-English sentence tying client feedback to what the PR delivers",
    "before": "Overall behavior BEFORE (from client task + PR)",
    "after": "Overall behavior AFTER",
    "userFlow": "Step-by-step flow QA should follow — derived from ActiveCollab task first",
    "changes": [
      {
        "area": "Short name from CLIENT FEEDBACK when possible, e.g. 'Graph dotted line removal'",
        "files": ["exact/file/path.tsx"],
        "before": "What users saw BEFORE (1-3 sentences)",
        "after": "What users see NOW (1-3 sentences)",
        "technicalNote": "Component, API, or file affected",
        "whatToVerify": "From client feedback — what QA must confirm"
      }
    ]
  },
  "requirementBreakdown": [{ "type": "Client feedback|Functional|...", "description": "string", "acceptanceCriteria": ["string"] }],
  "positiveTests": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "negativeTests": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "edgeCases": [{ "title": "string", "steps": ["string"], "expectedResult": "string", "category": "string" }],
  "impactedModules": [{ "moduleName": "string", "reason": "string", "testingPriority": "High|Medium|Low" }],
  "riskAssessment": [{ "risk": "string", "severity": "Critical|High|Medium|Low", "mitigation": "string" }],
  "regressionChecklist": [{ "category": "string", "items": ["string"] }],
  "onboardingSummary": "string (optional)"
}

WRITING RULES (critical):
1. featureSummary.changes must describe USER-VISIBLE behavior grouped by feature area (pages, UI, workflows) — NOT one card per file.
2. NEVER create change areas for: SQL migrations, supabase/config.toml, edge functions, package.json, lockfiles, eslint/tsconfig-only edits, README, CI workflows.
3. Read the actual PR diff patches to write concrete before/after — NEVER use generic placeholders like "Previous behavior before this PR" or "Updated per PR diff".
4. **EVERY numbered item in MANDATORY CLIENT FEEDBACK CHECKLIST must appear ONCE** in changes[] (use the exact comment wording for area/after) AND have exactly one matching positiveTests entry.
5. requirementBreakdown and regressionChecklist must list ALL client feedback items from comments — not a summary subset.
6. userFlow must be a numbered QA walkthrough covering the main client feedback themes.
7. Group related UI files (page + component + hook) into ONE change area when they deliver a single user-visible feature.
8. Every before/after must describe what a QA tester sees on screen — labels, buttons, navigation, data shown — not file names or code structure.
9. technicalNote is optional; use it only for a short component or API name, never raw migration paths.
10. Write at least one positive test per client feedback item.
11. negativeTests: minimum 3 — invalid inputs, empty states, error handling, disabled controls when data is missing.
12. edgeCases: minimum 2 — boundary values (zero, max), decimal precision, toggle edge behavior, refresh mid-flow.
13. Test steps must reference real UI labels from client comments and PR diffs.`;
}

function buildFileManifest(ctx: TestPilotContext): {
  qaBlock: string;
  excludedBlock: string;
  technicalBlock: string;
  qaCount: number;
} {
  const qaPaths = new Set(getQaRelevantPaths(ctx));
  const qaFiles = ctx.pr.changedFiles.filter((f) => qaPaths.has(f.filename));
  const technical = ctx.pr.changedFiles
    .filter((f) => isInfrastructureFile(f.filename))
    .map((f) => f.filename);
  const excluded = ctx.excludedFiles?.length
    ? ctx.excludedFiles
    : ctx.pr.changedFiles
      .filter((f) => !qaPaths.has(f.filename) && !isInfrastructureFile(f.filename))
      .map((f) => f.filename);

  const qaBlock = qaFiles.length
    ? qaFiles.map((f, i) => `${i + 1}. [${f.status}] ${f.filename}`).join("\n")
    : "No user-visible QA files.";

  const excludedBlock = excluded.length
    ? excluded.map((f) => `- ${f}`).join("\n")
    : "None";

  const technicalBlock = technical.length
    ? technical.map((f) => `- ${f}`).join("\n")
    : "None";

  return { qaBlock, excludedBlock, technicalBlock, qaCount: qaFiles.length };
}

function buildPrSections(ctx: TestPilotContext): string {
  const { qaBlock, excludedBlock, technicalBlock, qaCount } = buildFileManifest(ctx);
  const manifestBlock = `**USER-VISIBLE FILES (${qaCount} — reference in changes[].files when relevant; group by feature, not one card per file):**
${qaBlock}

**TECHNICAL / INFRASTRUCTURE (for risk context only — do NOT create changes[] entries for these):**
${technicalBlock}

**EXCLUDED from changes[] (dependencies, config tooling):**
${excludedBlock}`;

  const qaPathSet = new Set(getQaRelevantPaths(ctx));

  if (ctx.prs.length <= 1) {
    const pr = ctx.prs[0];
    const filesBlock = ctx.pr.changedFiles
      .filter((f) => qaPathSet.has(f.filename))
      .map((f) => {
        const patch = f.patch ? `\n${f.patch}` : "\n_(patch omitted)_";
        return `### ${f.status}: ${f.filename}${patch}`;
      })
      .join("\n\n");
    const commitsBlock = pr.commitMessages.map((m) => `- ${m}`).join("\n");

    return `${manifestBlock}

**PR #${pr.prNumber}:** ${pr.title}
**Head SHA:** ${pr.headSha}

**PR Description:**
${pr.body ?? "No PR description"}

**Changed Files Summary:**
${pr.diffSummary}

**Commit Messages:**
${commitsBlock}

**QA-relevant file diffs:**
${filesBlock || "_(no patches)_"}`;
  }

  const perPr = ctx.prs
    .map((pr) => {
      const commitsBlock = pr.commitMessages.map((m) => `- ${m}`).join("\n");
      return `### PR #${pr.prNumber}: ${pr.title}
**Description:** ${pr.body ?? "No PR description"}
**Files:** ${pr.diffSummary}
**Commits:** ${commitsBlock}`;
    })
    .join("\n\n");

  const mergedFilesBlock = ctx.pr.changedFiles
    .filter((f) => qaPathSet.has(f.filename))
    .map((f) => {
      const patch = f.patch ? `\n${f.patch}` : "\n_(patch omitted)_";
      return `### ${f.status}: ${f.filename}${patch}`;
    })
    .join("\n\n");

  return `${manifestBlock}

**Linked PRs:** ${ctx.prNumbers.map((n) => `#${n}`).join(", ")}

${perPr}

---

## Combined QA-relevant diffs

${mergedFilesBlock}`;
}

function buildActiveCollabBlock(ctx: TestPilotContext): string {
  const feedbackItems = extractClientFeedbackItems(ctx.task.description, ctx.task.comments);
  const checklist = formatFeedbackChecklist(feedbackItems);

  const commentsBlock = ctx.task.comments.length
    ? ctx.task.comments
      .map((c, i) => `### Comment ${i + 1} — ${c.author} (${c.createdAt})\n${c.body}`)
      .join("\n\n")
    : "No task comments";

  const source = ctx.activeCollabTaskId
    ? `ActiveCollab task #${ctx.activeCollabTaskId}${ctx.activeCollabProjectId ? ` (project ${ctx.activeCollabProjectId})` : ""}`
    : "Manual / pasted task context";

  return `## PRIMARY: Client task (${source})

**Task title:** ${ctx.task.title}

**MANDATORY CLIENT FEEDBACK CHECKLIST (${feedbackItems.length} items from COMMENTS ONLY — cover ALL in changes[] and positiveTests):**
${checklist}

**Task description (user story — context only, NOT a separate checklist):**
${ctx.task.description || "No description"}

**Full task comments (verbatim — do not skip nested bullets):**
${commentsBlock}`;
}

export function buildFeedbackTargetBlock(ctx: TestPilotContext): string {
  const count = extractClientFeedbackItems(ctx.task.description, ctx.task.comments).length;
  if (!count) return "";
  return [
    `**Client feedback coverage:** ${count} parsed items from ActiveCollab comments (not user story).`,
    `- positiveTests: at least ${count} (one per feedback item minimum)`,
    `- changes[]: each feedback theme must have a matching area or whatToVerify`,
    `- regressionChecklist: include every checklist item above`,
  ].join("\n");
}

export function buildUserPrompt(ctx: TestPilotContext): string {
  const acBlock = buildActiveCollabBlock(ctx);
  const prBlock = buildPrSections(ctx);
  const qaCount = getQaRelevantPaths(ctx).length;
  const feedbackBlock = buildFeedbackTargetBlock(ctx);

  const modulesBlock = ctx.project.modules
    .map((m) => `- ${m.name} (${m.id}): ${m.description}`)
    .join("\n");

  const pathHints = ctx.project.pathHints.length
    ? ctx.project.pathHints.join("\n")
    : "No path-based module hints";

  return `${acBlock}

---

## SECONDARY: GitHub PR changes

**Repository:** ${ctx.repo}

${prBlock}

---

## Project context

**Modules:** ${modulesBlock || "N/A"}
**Dependencies:** ${ctx.project.dependencies.join(", ") || "N/A"}
**Path hints:** ${pathHints}

**Onboarding reference:**
${getOnboardingContext()}

---

## Instructions

1. Read ActiveCollab task FIRST — every numbered checklist item must appear in the report.
2. Nested comment lines (e.g. Analysis section → Delta, Vega, Volatility Spread) are SEPARATE items — do not merge or skip them.
3. Use GitHub diffs to fill accurate, concrete before/after describing what users see on screen.
4. changes[] must group user-visible behavior by feature area. Do NOT add migrations, config.toml, or edge functions to changes[].
5. requirementBreakdown: one entry per client feedback item with acceptanceCriteria.
6. regressionChecklist: every client feedback item as a checkbox item.

${feedbackBlock}`;
}

export function buildPromptMessages(ctx: TestPilotContext) {
  return [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(ctx) },
  ];
}
