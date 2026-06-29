const DEFAULT_PROXY_BASE = "https://activecollab-api.managedcoder.com";

export interface ActiveCollabTaskContext {
  taskId: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string;
  assigneeName: string | null;
  taskUrl: string | null;
  comments: Array<{ author: string; body: string; createdAt: string }>;
}

interface RawAcTask {
  task_id: number;
  project_id: number;
  project_name: string;
  name: string;
  task_user_story?: string | null;
  assignee_full_name?: string | null;
  task_url?: string | null;
}

interface RawAcComment {
  latest_comment?: string | null;
  latest_comment_date?: string | null;
  commented_by?: string | null;
  commented_by_email?: string | null;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getProxyConfig() {
  const baseUrl = (Deno.env.get("ACTIVECOLLAB_PROXY_URL") ?? DEFAULT_PROXY_BASE).replace(/\/$/, "");
  const auth = Deno.env.get("ACTIVECOLLAB_PROXY_AUTH")?.trim();
  if (!auth) return null;
  const authorization = auth.startsWith("Basic ") ? auth : `Basic ${auth}`;
  return { baseUrl, authorization };
}

async function proxyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getProxyConfig();
  if (!config) {
    throw new Error("ACTIVECOLLAB_PROXY_AUTH is not configured");
  }

  const response = await fetch(`${config.baseUrl}/api/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.authorization,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: { status?: string; message?: string; data?: unknown };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`ActiveCollab API returned non-JSON (${response.status})`);
  }

  if (!response.ok || payload.status === "error") {
    throw new Error(payload.message ?? `ActiveCollab API error (${response.status})`);
  }

  return payload as T;
}

async function listProjectTasks(projectId: number, maxTasks = 150): Promise<RawAcTask[]> {
  const collected: RawAcTask[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= 6 && collected.length < maxTasks; page++) {
    const result = await proxyPost<{ data?: RawAcTask[] }>("ac-get-all-tasks", {
      project_id: projectId,
      limit: 50,
      page,
    });
    const batch = Array.isArray(result.data) ? result.data : [];
    if (!batch.length) break;

    for (const task of batch) {
      if (task.project_id !== projectId || seen.has(task.task_id)) continue;
      seen.add(task.task_id);
      collected.push(task);
    }
    if (batch.length < 50) break;
  }

  return collected;
}

async function fetchTaskComments(input: {
  taskId: number;
  projectId: number;
  taskName: string;
  projectName: string;
}) {
  const result = await proxyPost<{ data?: RawAcComment[] }>("ac-get-task-comments", {
    task_id: input.taskId,
    project_id: input.projectId,
    taskName: input.taskName,
    projectName: input.projectName,
  });

  const rows = Array.isArray(result.data) ? result.data : [];
  return rows
    .filter((row) => row.latest_comment?.trim())
    .map((row) => ({
      author: row.commented_by ?? row.commented_by_email ?? "Unknown",
      body: stripHtml(row.latest_comment),
      createdAt: row.latest_comment_date ?? new Date().toISOString(),
    }));
}

/** Server-side ActiveCollab fetch — authoritative when project + task IDs are provided. */
export async function fetchActiveCollabTaskContext(
  projectId: number,
  taskId: number,
  hints?: { taskName?: string; projectName?: string },
): Promise<ActiveCollabTaskContext | null> {
  if (!getProxyConfig()) {
    console.warn("[activecollab] ACTIVECOLLAB_PROXY_AUTH not set — using client-passed task context only");
    return null;
  }

  const tasks = await listProjectTasks(projectId);
  const found = tasks.find((t) => t.task_id === taskId);

  const taskName = found?.name ?? hints?.taskName?.trim() ?? "";
  const projectName = found?.project_name ?? hints?.projectName?.trim() ?? "";

  if (!found && !taskName) {
    console.warn(`[activecollab] task ${taskId} not found in project ${projectId}`);
    return null;
  }

  const comments = taskName && projectName
    ? await fetchTaskComments({ taskId, projectId, taskName, projectName })
    : [];

  return {
    taskId,
    projectId,
    projectName,
    title: found?.name ?? taskName,
    description: stripHtml(found?.task_user_story) || "",
    assigneeName: found?.assignee_full_name ?? null,
    taskUrl: found?.task_url ?? null,
    comments,
  };
}
