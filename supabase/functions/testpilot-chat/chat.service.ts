import { z } from "https://esm.sh/zod@3.25.76";
import type { QaReport } from "../testpilot-generate/types/qa-report.types.ts";
import { QaReportSchema } from "../testpilot-generate/types/qa-report.types.ts";
import { buildTestPilotContext } from "../testpilot-generate/ai/context-builder.ts";
import { getQaRelevantPaths } from "../testpilot-generate/ai/context-builder.ts";
import { chatCompletion } from "../testpilot-generate/lib/chat-completion.ts";
import { buildChatSystemPrompt } from "./prompt-builder.ts";

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(ChatTurnSchema).max(20).optional(),
  repo: z.string().min(1),
  prNumbers: z.array(z.number().int().positive()).min(1).max(10),
  report: QaReportSchema.optional(),
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
  taskComments: z
    .array(z.object({ author: z.string(), body: z.string(), createdAt: z.string() }))
    .optional(),
  activeCollabProjectId: z.number().int().positive().optional(),
  activeCollabTaskId: z.number().int().positive().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

function buildPrContextSummary(ctx: Awaited<ReturnType<typeof buildTestPilotContext>>): string {
  const qaPaths = getQaRelevantPaths(ctx);
  const fileList = qaPaths.slice(0, 40).map((f) => `- ${f}`).join("\n");
  const patches = ctx.pr.changedFiles
    .filter((f) => qaPaths.includes(f.filename) && f.patch)
    .slice(0, 8)
    .map((f) => `### ${f.filename}\n${(f.patch ?? "").slice(0, 2500)}`)
    .join("\n\n");

  return [
    `PR title: ${ctx.pr.title}`,
    ctx.pr.body ? `PR description: ${ctx.pr.body.slice(0, 2000)}` : "",
    `Diff summary: ${ctx.pr.diffSummary}`,
    `Commits:\n${ctx.pr.commitMessages.map((m) => `- ${m}`).join("\n")}`,
    `\nQA-relevant files (${qaPaths.length}):\n${fileList}`,
    patches ? `\nSample diffs:\n${patches}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function answerTestPilotQuestion(
  input: ChatRequest,
): Promise<{ reply: string; tokensUsed: number; model: string }> {
  let prContextBlock: string | undefined;

  if (!input.report) {
    const ctx = await buildTestPilotContext({
      prNumbers: input.prNumbers,
      repo: input.repo,
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription,
      taskComments: input.taskComments,
      activeCollabProjectId: input.activeCollabProjectId,
      activeCollabTaskId: input.activeCollabTaskId,
    });
    prContextBlock = buildPrContextSummary(ctx);
  }

  const system = buildChatSystemPrompt({
    repo: input.repo,
    prNumbers: input.prNumbers,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    taskComments: input.taskComments,
    report: input.report as QaReport | undefined,
    prContextBlock,
  });

  const history = (input.history ?? []).slice(-10).map((t) => ({
    role: t.role as "user" | "assistant",
    content: t.content,
  }));

  const result = await chatCompletion({
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: input.message },
    ],
    temperature: 0.2,
    max_tokens: 2500,
  });

  return {
    reply: result.content,
    tokensUsed: (result.input_tokens ?? 0) + (result.output_tokens ?? 0),
    model: result.model,
  };
}
