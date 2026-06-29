import { FormEvent, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { formatPrNumbersLabel } from "../lib/parsePrNumbers";
import { useTestPilotChat, type UseTestPilotChatOptions } from "../hooks/useTestPilotChat";

const STARTER_PROMPTS = [
  "What changed in this PR?",
  "What should I test first?",
  "List all positive test cases",
  "What are the highest risks?",
  "Explain the before vs after changes",
];

interface TestPilotChatContentProps {
  chatOptions: UseTestPilotChatOptions;
  messages: ReturnType<typeof useTestPilotChat>["messages"];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  hasReport: boolean;
  className?: string;
}

function TestPilotChatContent({
  chatOptions,
  messages,
  isLoading,
  sendMessage,
  clearChat,
  hasReport,
  className,
}: TestPilotChatContentProps) {
  const { profile } = useAuth();
  const [input, setInput] = useState("");
  const prLabel = formatPrNumbersLabel(chatOptions.prNumbers);
  const disabled = !chatOptions.repo || !chatOptions.prNumbers.length;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage(input);
    setInput("");
  };

  const handleStarter = (prompt: string) => {
    if (isLoading) return;
    void sendMessage(prompt);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            PR {prLabel} · <span className="font-mono">{chatOptions.repo}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {hasReport ? "Includes your QA report" : "Generate a report for richer answers"}
          </p>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={clearChat} disabled={isLoading}>
            <Trash2 className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => handleStarter(prompt)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-3">
        <div className="space-y-4 pr-2">
          {!messages.length && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="max-w-xs">
                Ask about changes, before/after behavior, test cases, risks, or client feedback for
                this PR only.
              </p>
              {!hasReport && (
                <Badge variant="outline" className="text-xs">
                  Tip: generate the QA report first
                </Badge>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[88%] rounded-lg px-3 py-2.5 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>{getInitials(profile?.full_name || "U")}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What tests cover the Analysis section?"
          disabled={disabled || isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || isLoading || !input.trim()} size="icon">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

/** Floating top-right icon — opens chat in a side sheet. */
export function TestPilotChatLauncher(chatOptions: UseTestPilotChatOptions) {
  const [open, setOpen] = useState(false);
  const chat = useTestPilotChat(chatOptions);
  const prLabel = formatPrNumbersLabel(chatOptions.prNumbers);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              aria-label="Ask TestPilot"
              onClick={() => setOpen(true)}
              className="fixed bottom-6 right-5 z-50 h-11 w-11 rounded-full shadow-lg ring-1 ring-primary/20 transition-transform hover:scale-105"
            >
              <MessageCircle className="h-5 w-5" />
              {chat.messages.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="font-medium">
            Ask TestPilot
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-4 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Ask TestPilot
            </SheetTitle>
            <SheetDescription>
              Questions scoped to PR {prLabel} only
            </SheetDescription>
          </SheetHeader>
          <TestPilotChatContent
            chatOptions={chatOptions}
            messages={chat.messages}
            isLoading={chat.isLoading}
            sendMessage={chat.sendMessage}
            clearChat={chat.clearChat}
            hasReport={chat.hasReport}
            className="flex-1"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
