import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/config/api";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { cacheConfig } from "@/lib/cache";
import type {
  GetActiveCollabTaskDetailsResponse,
  ListActiveCollabTasksResponse,
} from "../types/activecollab.types";

export function useActiveCollabProjectTasks(projectId: number | null) {
  return useQuery({
    queryKey: ["testpilot", "ac-tasks", projectId],
    queryFn: async () => {
      const data = await invokeEdgeFunction<ListActiveCollabTasksResponse>(
        API.TESTPILOT.ACTIVECOLLAB,
        { action: "listTasks", project_id: projectId },
      );
      return data.tasks ?? [];
    },
    enabled: projectId != null && projectId > 0,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useActiveCollabTaskDetails(input: {
  projectId: number | null;
  taskId: number | null;
  taskName?: string;
  projectName?: string;
}) {
  const { projectId, taskId, taskName, projectName } = input;

  return useQuery({
    queryKey: ["testpilot", "ac-task", projectId, taskId],
    queryFn: async () => {
      const data = await invokeEdgeFunction<GetActiveCollabTaskDetailsResponse>(
        API.TESTPILOT.ACTIVECOLLAB,
        {
          action: "getTaskDetails",
          project_id: projectId,
          task_id: taskId,
          task_name: taskName,
          project_name: projectName,
        },
      );
      return { task: data.task, comments: data.comments ?? [] };
    },
    enabled: projectId != null && projectId > 0 && taskId != null && taskId > 0,
    staleTime: cacheConfig.staleTime.short,
  });
}
