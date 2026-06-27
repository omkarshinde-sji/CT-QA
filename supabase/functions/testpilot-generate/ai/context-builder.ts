import type { TestPilotContext } from "../types/qa-report.types.ts";
import { fetchPullRequestContexts } from "../services/github.service.ts";
import { getProjectContext } from "../services/project-context.service.ts";

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

export async function buildTestPilotContext(
  input: BuildContextInput,
): Promise<TestPilotContext> {
  const { prNumbers, prs, merged } = await fetchPullRequestContexts(input.prNumbers, input.repo);

  const changedPaths = merged.changedFiles.map((f) => f.filename);
  const project = getProjectContext(changedPaths);

  const manualTitle = input.taskTitle?.trim() ?? "";
  const manualDescription = input.taskDescription?.trim() ?? "";
  const taskComments = input.taskComments ?? [];
  const activeCollabTaskId = input.activeCollabTaskId ?? null;
  const activeCollabProjectId = input.activeCollabProjectId ?? null;

  const contextHash = await computeContextHash(
    `${merged.repo}:${merged.headSha}:${prNumbers.join(",")}:${manualTitle}:${manualDescription}:${activeCollabTaskId ?? ""}:${JSON.stringify(taskComments)}`,
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
      title: manualTitle || merged.title,
      description: manualDescription || merged.body,
      status: activeCollabTaskId ? "activecollab" : manualTitle ? "manual" : "from_pr",
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
  };
}
