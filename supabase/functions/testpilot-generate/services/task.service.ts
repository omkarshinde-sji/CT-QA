import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TaskContext {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  projectId: string | null;
  comments: Array<{ author: string; body: string; createdAt: string }>;
}

export async function fetchTaskContext(
  supabase: SupabaseClient,
  taskId: string,
): Promise<TaskContext> {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, description, status, updated_at, metadata, project_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw new Error(`Failed to load task: ${taskError.message}`);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const { data: comments, error: commentsError } = await supabase
    .from("task_comments")
    .select("content, created_at, user_id, jira_author_name")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    throw new Error(`Failed to load task comments: ${commentsError.message}`);
  }

  const userIds = [...new Set((comments ?? []).map((c) => c.user_id).filter(Boolean))];
  const profileMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, profile.full_name || profile.email || "Unknown");
    }
  }

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    updatedAt: task.updated_at,
    metadata: (task.metadata as Record<string, unknown> | null) ?? null,
    projectId: task.project_id,
    comments: (comments ?? []).map((comment) => ({
      author: comment.user_id
        ? (profileMap.get(comment.user_id) ?? "Unknown")
        : (comment.jira_author_name ?? "Unknown"),
      body: comment.content,
      createdAt: comment.created_at ?? new Date().toISOString(),
    })),
  };
}

export function getRepoFromTaskMetadata(metadata: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined;
  const repo = metadata.github_repo ?? metadata.repo;
  return typeof repo === "string" ? repo : undefined;
}
