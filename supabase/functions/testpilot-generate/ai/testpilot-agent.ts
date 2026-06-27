import type { TestPilotContext, QaReport } from "../types/qa-report.types.ts";
import { chatCompletion } from "../lib/chat-completion.ts";
import { buildPromptMessages } from "./prompt-builder.ts";
import { buildRetryPrompt, parseAndValidateQaReport } from "./output-parser.ts";

const MAX_ATTEMPTS = 3;

export class TestPilotAgentError extends Error {
  constructor(
    message: string,
    public readonly validationErrors?: string[],
  ) {
    super(message);
    this.name = "TestPilotAgentError";
  }
}

export interface AgentRunResult {
  report: QaReport;
  model: string;
  tokensUsed: number;
}

export async function runTestPilotAgent(ctx: TestPilotContext): Promise<AgentRunResult> {
  const messages = buildPromptMessages(ctx);
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await chatCompletion({
      messages,
      temperature: 0.3,
      max_tokens: 4000,
    });

    const parsed = parseAndValidateQaReport(result.content);
    if (parsed.success && parsed.report) {
      return {
        report: parsed.report,
        model: result.model,
        tokensUsed: (result.input_tokens ?? 0) + (result.output_tokens ?? 0),
      };
    }

    lastErrors = parsed.errors ?? ["Unknown validation error"];
    console.warn(`[testpilot-agent] attempt ${attempt} failed:`, lastErrors);

    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: result.content },
        { role: "user", content: buildRetryPrompt(lastErrors) },
      );
    }
  }

  throw new TestPilotAgentError(
    `Failed to generate valid QA report after ${MAX_ATTEMPTS} attempts`,
    lastErrors,
  );
}
