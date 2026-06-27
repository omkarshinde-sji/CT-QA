import type { TestPilotContext } from "../types/qa-report.types.ts";
import { fetchPullRequestContext, normalizeGithubRepo } from "../services/github.service.ts";
import { getProjectContext } from "../services/project-context.service.ts";

export interface BuildContextInput {
  prNumber: number;
  repo: string;
  taskTitle?: string;
  taskDescription?: string;
}

async function computeContextHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildTestPilotContext(
  input: BuildContextInput,
): Promise<TestPilotContext> {
  const normalizedRepo = normalizeGithubRepo(input.repo);
  if (!normalizedRepo) {
    throw new Error("Invalid GitHub repo. Use owner/repo or paste a full GitHub URL.");
  }

  const pr = await fetchPullRequestContext(input.prNumber, normalizedRepo);
  const changedPaths = pr.changedFiles.map((f) => f.filename);
  const project = getProjectContext(changedPaths);

  const manualTitle = input.taskTitle?.trim() ?? "";
  const manualDescription = input.taskDescription?.trim() ?? "";

  const contextHash = await computeContextHash(
    `${pr.repo}:${pr.headSha}:${input.prNumber}:${manualTitle}:${manualDescription}`,
  );

  return {
    taskId: null,
    prNumber: input.prNumber,
    repo: pr.repo,
    contextHash,
    task: {
      title: manualTitle || pr.title,
      description: manualDescription || pr.body,
      status: manualTitle ? "manual" : "from_pr",
      comments: [],
    },
    pr: {
      title: pr.title,
      body: pr.body,
      changedFiles: pr.changedFiles,
      commitMessages: pr.commitMessages,
      diffSummary: pr.diffSummary,
      headSha: pr.headSha,
    },
    project,
  };
}
