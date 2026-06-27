import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  GitPullRequest,
  Github,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isValidGithubRepo, normalizeGithubRepo } from "../lib/normalizeGithubRepo";

interface TaskPrPickerProps {
  taskTitle: string;
  taskDescription: string;
  prNumber: string;
  repoOverride: string;
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onPrNumberChange: (value: string) => void;
  onRepoOverrideChange: (value: string) => void;
  disabled?: boolean;
}

export function TaskPrPicker({
  taskTitle,
  taskDescription,
  prNumber,
  repoOverride,
  onTaskTitleChange,
  onTaskDescriptionChange,
  onPrNumberChange,
  onRepoOverrideChange,
  disabled,
}: TaskPrPickerProps) {
  const [optionalOpen, setOptionalOpen] = useState(
    Boolean(taskTitle.trim() || taskDescription.trim()),
  );

  const repoValid = isValidGithubRepo(repoOverride);
  const normalizedRepo = normalizeGithubRepo(repoOverride);
  const prValid = Boolean(prNumber && Number(prNumber) > 0);
  const hasOptional = Boolean(taskTitle.trim() || taskDescription.trim());

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <Github className="h-4 w-4 text-primary" />
          PR source
        </div>

        <div className="space-y-2">
          <Label htmlFor="repo-override" className="text-xs uppercase tracking-wide text-muted-foreground">
            GitHub repository
          </Label>
          <div className="relative">
            <Input
              id="repo-override"
              placeholder="owner/repo or paste GitHub URL"
              value={repoOverride}
              onChange={(e) => onRepoOverrideChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "pr-9 font-mono text-sm",
                repoValid && "border-green-500/50 focus-visible:ring-green-500/30",
              )}
            />
            {repoValid && (
              <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
            )}
          </div>
          {normalizedRepo && repoOverride.trim() !== normalizedRepo && (
            <p className="text-xs text-muted-foreground">
              Using: <span className="font-mono text-foreground">{normalizedRepo}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pr-number" className="text-xs uppercase tracking-wide text-muted-foreground">
            Pull request number
          </Label>
          <div className="relative">
            <GitPullRequest className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pr-number"
              type="number"
              min={1}
              placeholder="e.g. 27"
              value={prNumber}
              onChange={(e) => onPrNumberChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "pl-9",
                prValid && "border-green-500/50 focus-visible:ring-green-500/30",
              )}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              repoValid
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {repoValid ? <CheckCircle2 className="h-3 w-3" /> : null}
            Repo {repoValid ? "ready" : "required"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              prValid
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {prValid ? <CheckCircle2 className="h-3 w-3" /> : null}
            PR {prValid ? `#${prNumber}` : "required"}
          </span>
        </div>
      </div>

      <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
        <div className="rounded-xl border bg-muted/20 p-4">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex h-auto w-full items-center justify-between p-0 hover:bg-transparent"
              disabled={disabled}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-background text-xs font-bold">
                  2
                </span>
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                Task context
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  optional
                </span>
                {hasOptional && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                    filled
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  optionalOpen && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task title</Label>
              <Input
                id="task-title"
                placeholder="e.g. MCP server connection improvements"
                value={taskTitle}
                onChange={(e) => onTaskTitleChange(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Task description</Label>
              <Textarea
                id="task-description"
                placeholder="Acceptance criteria, user story, or QA notes..."
                value={taskDescription}
                onChange={(e) => onTaskDescriptionChange(e.target.value)}
                disabled={disabled}
                rows={3}
                className="resize-none"
              />
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Leave blank to use the PR title and description from GitHub.
            </p>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
