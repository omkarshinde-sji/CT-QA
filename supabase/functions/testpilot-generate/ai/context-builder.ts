import type { TestPilotContext } from "../types/qa-report.types.ts";
import { PROMPT_VERSION } from "../types/qa-report.types.ts";
import { fetchPullRequestContexts } from "../services/github.service.ts";
import { getProjectContext } from "../services/project-context.service.ts";
import { fetchActiveCollabTaskContext } from "../services/activecollab.service.ts";
import { isQaRelevantChangedFile, partitionChangedFiles } from "../services/qa-relevant-files.ts";

export interface BuildContextInput {
  prNumbers: number[];
  repo: string;
  taskTitle?: string;
  taskDescription?: string;
  taskComments?: Array<{ author: string; body: string; createdAt: string }>;
  activeCollabProjectId?: number;
  activeCollabTaskId?: number;
}

async function computeContextHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mergeComments(
  server: Array<{ author: string; body: string; createdAt: string }>,
  client: Array<{ author: string; body: string; createdAt: string }>,
) {
  if (!server.length) return client;
  if (!client.length) return server;
  const seen = new Set(server.map((c) => `${c.author}:${c.body.slice(0, 80)}`));
  const merged = [...server];
  for (const c of client) {
    const key = `${c.author}:${c.body.slice(0, 80)}`;
    if (!seen.has(key)) merged.push(c);
  }
  return merged;
}

export async function buildTestPilotContext(
  input: BuildContextInput,
): Promise<TestPilotContext> {
  const { prNumbers, prs, merged } = await fetchPullRequestContexts(input.prNumbers, input.repo);

  const changedPaths = merged.changedFiles.map((f) => f.filename);
  const project = getProjectContext(changedPaths);
  const { qaRelevant, excluded } = partitionChangedFiles(merged.changedFiles);

  let taskTitle = input.taskTitle?.trim() ?? "";
  let taskDescription = input.taskDescription?.trim() ?? "";
  let taskComments = input.taskComments ?? [];
  const activeCollabTaskId = input.activeCollabTaskId ?? null;
  const activeCollabProjectId = input.activeCollabProjectId ?? null;

  if (activeCollabProjectId && activeCollabTaskId) {
    try {
      const ac = await fetchActiveCollabTaskContext(
        activeCollabProjectId,
        activeCollabTaskId,
        { taskName: taskTitle || undefined },
      );
      if (ac) {
        taskTitle = ac.title || taskTitle;
        taskDescription = ac.description || taskDescription;
        taskComments = mergeComments(ac.comments, taskComments);
        console.log(
          `[context-builder] ActiveCollab task #${ac.taskId}: "${ac.title}" (${ac.comments.length} comments)`,
        );
      }
    } catch (error) {
      console.warn("[context-builder] ActiveCollab fetch failed:", error);
    }
  }

  const contextHash = await computeContextHash(
    `${PROMPT_VERSION}:${merged.repo}:${merged.headSha}:${prNumbers.join(",")}:${taskTitle}:${taskDescription}:${activeCollabTaskId ?? ""}:${JSON.stringify(taskComments)}`,
  );

  return {
    taskId: null,
    activeCollabTaskId,
    activeCollabProjectId,
    prNumbers,
    prNumber: prNumbers[0],
    repo: merged.repo,
    contextHash,
    prs: prs.map((pr) => ({
      prNumber: pr.prNumber,
      title: pr.title,
      body: pr.body,
      headSha: pr.headSha,
      diffSummary: pr.diffSummary,
      commitMessages: pr.commitMessages,
      changedFiles: pr.changedFiles,
    })),
    task: {
      title: taskTitle || merged.title,
      description: taskDescription || merged.body || "",
      status: activeCollabTaskId ? "activecollab" : taskTitle ? "manual" : "from_pr",
      comments: taskComments,
    },
    pr: {
      title: merged.title,
      body: merged.body,
      changedFiles: merged.changedFiles,
      commitMessages: merged.commitMessages,
      diffSummary: merged.diffSummary,
      headSha: merged.headSha,
    },
    project,
    qaRelevantFiles: qaRelevant,
    excludedFiles: excluded.map((f) => f.filename),
  };
}

export function getQaRelevantPaths(ctx: TestPilotContext): string[] {
  if (ctx.qaRelevantFiles?.length) {
    return ctx.qaRelevantFiles.map((f) => f.filename);
  }
  return ctx.pr.changedFiles
    .map((f) => f.filename)
    .filter((f) => isQaRelevantChangedFile(f));
}
