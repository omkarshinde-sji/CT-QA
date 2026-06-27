import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { TestPilotContext } from "../types/qa-report.types.ts";
import { fetchPullRequestContext } from "../services/github.service.ts";
import { fetchTaskContext, getRepoFromTaskMetadata } from "../services/task.service.ts";
import { getProjectContext } from "../services/project-context.service.ts";

export interface BuildContextInput {
  taskId: string;
  prNumber: number;
  repoOverride?: string;
}

async function computeContextHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildTestPilotContext(
  supabase: SupabaseClient,
  input: BuildContextInput,
): Promise<TestPilotContext> {
  const task = await fetchTaskContext(supabase, input.taskId);
  const repo = input.repoOverride ?? getRepoFromTaskMetadata(task.metadata);
  const pr = await fetchPullRequestContext(input.prNumber, repo);

  const changedPaths = pr.changedFiles.map((f) => f.filename);
  const project = getProjectContext(changedPaths);

  const contextHash = await computeContextHash(
    `${task.id}:${task.updatedAt}:${pr.headSha}:${pr.repo}`,
  );

  return {
    taskId: task.id,
    prNumber: input.prNumber,
    repo: pr.repo,
    contextHash,
    task: {
      title: task.title,
      description: task.description,
      status: task.status,
      comments: task.comments,
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
