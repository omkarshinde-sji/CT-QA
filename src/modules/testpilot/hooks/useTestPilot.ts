import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API } from "@/shared/config/api";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { invalidateKeys } from "@/lib/cache";
import type {
  GenerateTestPilotRequest,
  GenerateTestPilotResponse,
  QaReportWithMeta,
} from "../types/qa-report.types";

export function useGenerateTestPilotReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateTestPilotRequest): Promise<QaReportWithMeta> => {
      const data = await invokeEdgeFunction<GenerateTestPilotResponse>(
        API.TESTPILOT.GENERATE,
        input,
      );
      if (!data.success || !data.report) {
        throw new Error("Failed to generate QA report");
      }
      return { ...data.report, cached: data.cached };
    },
    onSuccess: (report) => {
      invalidateKeys.testpilot(queryClient, report.taskId);
      toast.success(
        report.cached ? "Loaded cached QA report" : "QA report generated successfully",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate QA report");
    },
  });
}
