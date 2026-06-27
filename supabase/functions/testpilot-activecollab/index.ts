import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth, authErrorResponse } from "../testpilot-generate/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROXY_BASE = "https://activecollab-api.managedcoder.com";

interface RawAcTask {
  task_id: number;
  project_id: number;
  project_name: string;
  name: string;
  task_list_name?: string | null;
  task_user_story?: string | null;
  assignee_full_name?: string | null;
  task_url?: string | null;
  is_completed?: number;
  updated_on?: string | null;
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
  if (!auth) {
    throw new Error(
      "ACTIVECOLLAB_PROXY_AUTH is not configured. Add the Basic auth value to Supabase Edge Function secrets.",
    );
  }
  const authorization = auth.startsWith("Basic ") ? auth : `Basic ${auth}`;
  return { baseUrl, authorization };
}

async function proxyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { baseUrl, authorization } = getProxyConfig();
  const response = await fetch(`${baseUrl}/api/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
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

function normalizeTask(raw: RawAcTask) {
  return {
    taskId: raw.task_id,
    projectId: raw.project_id,
    projectName: raw.project_name,
    name: raw.name,
    description: stripHtml(raw.task_user_story),
    assigneeName: raw.assignee_full_name ?? null,
    taskListName: raw.task_list_name ?? null,
    taskUrl: raw.task_url ?? null,
    isCompleted: Boolean(raw.is_completed),
    updatedOn: raw.updated_on ?? null,
  };
}

async function listProjectTasks(projectId: number, maxTasks = 100) {
  const collected: RawAcTask[] = [];
  const seen = new Set<number>();
  const pageSize = 50;
  const maxPages = 8;

  for (let page = 1; page <= maxPages && collected.length < maxTasks; page++) {
    const result = await proxyPost<{ data?: RawAcTask[] }>("ac-get-all-tasks", {
      project_id: projectId,
      limit: pageSize,
      page,
    });

    const batch = Array.isArray(result.data) ? result.data : [];
    if (!batch.length) break;

    for (const task of batch) {
      if (task.project_id !== projectId || seen.has(task.task_id)) continue;
      seen.add(task.task_id);
      collected.push(task);
      if (collected.length >= maxTasks) break;
    }

    if (batch.length < pageSize) break;
  }

  collected.sort((a, b) => {
    const aTime = a.updated_on ? Date.parse(a.updated_on) : 0;
    const bTime = b.updated_on ? Date.parse(b.updated_on) : 0;
    return bTime - aTime;
  });

  return collected.map(normalizeTask);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);
    await validateAuth(req, supabase);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = body.action;
    if (action === "listTasks") {
      const projectId = Number(body.project_id);
      if (!Number.isFinite(projectId) || projectId <= 0) {
        return new Response(JSON.stringify({ error: "project_id must be a positive number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tasks = await listProjectTasks(projectId);
      return new Response(JSON.stringify({ success: true, tasks }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getTaskDetails") {
      const taskId = Number(body.task_id);
      const projectId = Number(body.project_id);
      const taskName = typeof body.task_name === "string" ? body.task_name.trim() : "";
      const projectName = typeof body.project_name === "string" ? body.project_name.trim() : "";

      if (!Number.isFinite(taskId) || taskId <= 0 || !Number.isFinite(projectId) || projectId <= 0) {
        return new Response(JSON.stringify({ error: "task_id and project_id are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let task = null as ReturnType<typeof normalizeTask> | null;
      const tasks = await listProjectTasks(projectId, 200);
      const found = tasks.find((t) => t.taskId === taskId);

      if (found) {
        task = found;
      } else if (taskName && projectName) {
        task = {
          taskId,
          projectId,
          projectName,
          name: taskName,
          description: "",
          assigneeName: null,
          taskListName: null,
          taskUrl: null,
          isCompleted: false,
          updatedOn: null,
        };
      } else {
        return new Response(JSON.stringify({ error: "Task not found in project" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const comments = await fetchTaskComments({
        taskId: task.taskId,
        projectId: task.projectId,
        taskName: task.name,
        projectName: task.projectName,
      });

      return new Response(JSON.stringify({ success: true, task, comments }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use listTasks or getTaskDetails." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && "code" in error) {
      return authErrorResponse(error as { status: number; code: string; message: string }, corsHeaders);
    }

    console.error("[testpilot-activecollab] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
