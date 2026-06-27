import type { TestPilotContext } from "../types/qa-report.types.ts";
import { getOnboardingContext } from "../services/project-context.service.ts";

export function buildSystemPrompt(): string {
  return `You are a senior QA staff engineer and test architect for an enterprise React + Supabase application.

Analyze the task context, GitHub PR changes, and project structure to produce a focused QA intelligence report for manual testers.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "featureSummary": {
    "summary": "string",
    "before": "string (optional, for changes to existing features)",
    "after": "string (optional, for changes to existing features)",
    "userFlow": "string (optional, for new features)"
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

Requirements:
- For existing features: featureSummary must include before and after behavior.
- For new features: featureSummary must explain functionality and userFlow.
- Extract functional requirements, validation rules, user flows, and expected outcomes in requirementBreakdown.
- Generate thorough test scenarios: positive, negative, boundary, permissions, API failures, loading/empty states, network failures, concurrency, responsive layouts, data integrity.
- impactedModules must reference actual changed file paths and module names from context.
- riskAssessment must cover breaking changes, schema changes, auth, RBAC, state management, API dependencies, performance, backward compatibility.
- regressionChecklist must group items by: Authentication, Dashboard, CRUD flows, Forms, Search, Filters, Notifications, Permissions, API integrations, Responsive layouts, Navigation, Existing features.
- Be specific to the actual PR diff — testers should only verify affected functionality, not the whole app.
- onboardingSummary should briefly explain impacted modules for new team members.`;
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
${onboardingBase}`;
}

export function buildPromptMessages(ctx: TestPilotContext) {
  return [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(ctx) },
  ];
}
