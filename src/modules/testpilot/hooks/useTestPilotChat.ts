import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "@/shared/config/api";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { prepareReportForDisplay } from "../lib/prepareReportForDisplay";
import type {
  QaReport,
  QaReportWithMeta,
  TaskCommentInput,
  TestPilotChatMessage,
  TestPilotChatRequest,
  TestPilotChatResponse,
} from "../types/qa-report.types";

export interface UseTestPilotChatOptions {
  repo: string;
  prNumbers: number[];
  report?: QaReportWithMeta | null;
  taskTitle?: string;
  taskDescription?: string;
  taskComments?: TaskCommentInput[];
  activeCollabProjectId?: number;
  activeCollabTaskId?: number;
}

function chatStorageKey(repo: string, prNumbers: number[]): string {
  return `testpilot:chat:v1:${repo}:${[...prNumbers].sort((a, b) => a - b).join(",")}`;
}

function loadStoredMessages(key: string): TestPilotChatMessage[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TestPilotChatMessage[];
    return Array.isArray(parsed) ? parsed.filter((m) => m.role && m.content) : [];
  } catch {
    return [];
  }
}

export function useTestPilotChat(options: UseTestPilotChatOptions) {
  const scopeKey = useMemo(
    () => chatStorageKey(options.repo, options.prNumbers),
    [options.repo, options.prNumbers],
  );

  const [messages, setMessages] = useState<TestPilotChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMessages(loadStoredMessages(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    if (!scopeKey) return;
    try {
      sessionStorage.setItem(scopeKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore quota errors
    }
  }, [messages, scopeKey]);

  const reportForChat: QaReport | undefined = useMemo(() => {
    if (!options.report) return undefined;
    return prepareReportForDisplay(options.report, {
      taskDescription: options.taskDescription,
      taskComments: options.taskComments,
    });
  }, [options.report, options.taskDescription, options.taskComments]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !options.repo || !options.prNumbers.length) return;

      const userMessage: TestPilotChatMessage = { role: "user", content: trimmed };
      const history = [...messages, userMessage];
      setMessages(history);
      setIsLoading(true);

      try {
        const body: TestPilotChatRequest = {
          message: trimmed,
          history: messages,
          repo: options.repo,
          prNumbers: options.prNumbers,
          report: reportForChat,
          taskTitle: options.taskTitle?.trim() || undefined,
          taskDescription: options.taskDescription?.trim() || undefined,
          taskComments: options.taskComments?.length ? options.taskComments : undefined,
          activeCollabProjectId: options.activeCollabProjectId,
          activeCollabTaskId: options.activeCollabTaskId,
        };

        const data = await invokeEdgeFunction<TestPilotChatResponse>(API.TESTPILOT.CHAT, body);
        if (!data.success || !data.reply) {
          throw new Error("No reply from TestPilot chat");
        }

        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (error) {
        setMessages(messages);
        toast.error(error instanceof Error ? error.message : "Failed to send message");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options, reportForChat],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(scopeKey);
    } catch {
      // ignore
    }
  }, [scopeKey]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    hasReport: Boolean(options.report),
  };
}
