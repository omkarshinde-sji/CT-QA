import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  ExternalLink,
  GitPullRequest,
  Github,
  ListChecks,
  CheckCircle2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/componentOptimization";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidGithubRepo, normalizeGithubRepo } from "../lib/normalizeGithubRepo";
import { parsePrNumbersInput } from "../lib/parsePrNumbers";
import {
  useActiveCollabProjectTasks,
  useActiveCollabTaskDetails,
} from "../hooks/useActiveCollabTasks";
import type { ActiveCollabTaskComment } from "../types/activecollab.types";
import { ActiveCollabCommentsList } from "./ActiveCollabCommentsList";

interface TaskPrPickerProps {
  taskTitle: string;
  taskDescription: string;
  prNumbers: number[];
  repoOverride: string;
  acProjectId: string;
  acTaskId: string;
  acTaskComments: ActiveCollabTaskComment[];
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onAddPrNumber: (pr: number) => void;
  onRemovePrNumber: (pr: number) => void;
  onRepoOverrideChange: (value: string) => void;
  onAcProjectIdChange: (value: string) => void;
  onAcTaskIdChange: (value: string) => void;
  onActiveCollabContextLoaded: (input: {
    title: string;
    description: string;
    comments: ActiveCollabTaskComment[];
  }) => void;
  disabled?: boolean;
}

export function TaskPrPicker({
  taskTitle,
  taskDescription,
  prNumbers,
  repoOverride,
  acProjectId,
  acTaskId,
  acTaskComments,
  onTaskTitleChange,
  onTaskDescriptionChange,
  onAddPrNumber,
  onRemovePrNumber,
  onRepoOverrideChange,
  onAcProjectIdChange,
  onAcTaskIdChange,
  onActiveCollabContextLoaded,
  disabled,
}: TaskPrPickerProps) {
  const [optionalOpen, setOptionalOpen] = useState(
    Boolean(
      taskTitle.trim() ||
        taskDescription.trim() ||
        acProjectId.trim() ||
        acTaskId.trim(),
    ),
  );
  const [taskSearch, setTaskSearch] = useState("");
  const [prDraft, setPrDraft] = useState("");

  const repoValid = isValidGithubRepo(repoOverride);
  const normalizedRepo = normalizeGithubRepo(repoOverride);
  const prValid = prNumbers.length > 0;
  const hasOptional = Boolean(taskTitle.trim() || taskDescription.trim());
  const hasAcLink = Boolean(acProjectId.trim() && acTaskId.trim());

  const debouncedProjectId = useDebouncedValue(acProjectId.trim(), 500);
  const parsedProjectId = debouncedProjectId ? Number(debouncedProjectId) : null;
  const projectIdValid = parsedProjectId != null && Number.isFinite(parsedProjectId) && parsedProjectId > 0;

  const {
    data: acTasks = [],
    isFetching: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useActiveCollabProjectTasks(projectIdValid ? parsedProjectId : null);

  const parsedTaskId = acTaskId ? Number(acTaskId) : null;
  const selectedTaskSummary = acTasks.find((t) => t.taskId === parsedTaskId);

  const {
    data: acTaskDetails,
    isFetching: detailsLoading,
    isError: detailsError,
  } = useActiveCollabTaskDetails({
    projectId: projectIdValid ? parsedProjectId : null,
    taskId: parsedTaskId && parsedTaskId > 0 ? parsedTaskId : null,
    taskName: selectedTaskSummary?.name,
    projectName: selectedTaskSummary?.projectName,
  });

  useEffect(() => {
    if (!acTaskDetails?.task) return;
    onActiveCollabContextLoaded({
      title: acTaskDetails.task.name,
      description: acTaskDetails.task.description,
      comments: acTaskDetails.comments,
    });
  }, [acTaskDetails, onActiveCollabContextLoaded]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return acTasks;
    return acTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        String(t.taskId).includes(q) ||
        (t.taskListName?.toLowerCase().includes(q) ?? false),
    );
  }, [acTasks, taskSearch]);

  const tasksErrorMessage = tasksError ? (tasksErrorObj as Error)?.message : null;
  const acNotConfigured = Boolean(
    tasksErrorMessage?.includes("ACTIVECOLLAB_PROXY_AUTH") ||
      tasksErrorMessage?.includes("not configured"),
  );

  const displayedComments =
    acTaskDetails?.comments?.length ? acTaskDetails.comments : acTaskComments;

  const commitPrDraft = () => {
    const parsed = parsePrNumbersInput(prDraft);
    if (!parsed.length) return;
    for (const pr of parsed) {
      if (!prNumbers.includes(pr)) onAddPrNumber(pr);
    }
    setPrDraft("");
  };

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
            Pull request numbers
          </Label>
          <p className="text-xs text-muted-foreground">
            Link every PR branch for this feature — add one or many (comma-separated).
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <GitPullRequest className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pr-number"
                placeholder="e.g. 27 or 3, 4, 5"
                value={prDraft}
                onChange={(e) => setPrDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPrDraft();
                  }
                }}
                disabled={disabled}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="shrink-0"
              onClick={commitPrDraft}
              disabled={disabled || !prDraft.trim()}
              aria-label="Add PR number"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {prNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {prNumbers.map((pr) => (
                <Badge
                  key={pr}
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 font-mono text-xs"
                >
                  #{pr}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => onRemovePrNumber(pr)}
                    disabled={disabled}
                    aria-label={`Remove PR ${pr}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
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
            {prValid
              ? `${prNumbers.length} PR${prNumbers.length === 1 ? "" : "s"} linked`
              : "PR required"}
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
                {(hasOptional || hasAcLink) && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                    linked
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
          <CollapsibleContent className="mt-4 space-y-5">
            <div className="space-y-3 rounded-lg border border-dashed bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ActiveCollab
                </Label>
                {hasAcLink && (
                  <Badge variant="secondary" className="text-[10px]">
                    AC #{acTaskId}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ac-project-id" className="text-sm">
                  Project ID
                </Label>
                <Input
                  id="ac-project-id"
                  type="number"
                  min={1}
                  placeholder="e.g. 3510"
                  value={acProjectId}
                  onChange={(e) => {
                    onAcProjectIdChange(e.target.value);
                    onAcTaskIdChange("");
                  }}
                  disabled={disabled}
                />
              </div>

              {acNotConfigured && (
                <Alert variant="default" className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertTitle className="text-sm">ActiveCollab not connected yet</AlertTitle>
                  <AlertDescription className="space-y-2 text-xs">
                    <p>
                      An admin must add the API credentials as a Supabase Edge Function secret
                      (one-time setup).
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                      <li>
                        Open Supabase Dashboard → Edge Functions →{" "}
                        <strong className="text-foreground">Secrets</strong>
                      </li>
                      <li>
                        Add secret{" "}
                        <code className="rounded bg-muted px-1 py-0.5">ACTIVECOLLAB_PROXY_AUTH</code>{" "}
                        with your Basic auth Base64 value
                      </li>
                      <li>
                        Optional:{" "}
                        <code className="rounded bg-muted px-1 py-0.5">ACTIVECOLLAB_PROXY_URL</code>{" "}
                        = <code className="rounded bg-muted px-1 py-0.5">https://activecollab-api.managedcoder.com</code>
                      </li>
                    </ol>
                    <p className="text-muted-foreground">
                      You can still enter task title and description manually below.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {projectIdValid && !acNotConfigured && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ac-task-select" className="text-sm">
                      Task
                    </Label>
                    {tasksLoading && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </span>
                    )}
                  </div>
                  {acTasks.length > 8 && (
                    <Input
                      placeholder="Search tasks…"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      disabled={disabled || tasksLoading}
                      className="h-8 text-sm"
                    />
                  )}
                  <Select
                    value={acTaskId || undefined}
                    onValueChange={onAcTaskIdChange}
                    disabled={disabled || tasksLoading || !acTasks.length}
                  >
                    <SelectTrigger id="ac-task-select">
                      <SelectValue
                        placeholder={
                          tasksLoading
                            ? "Loading tasks…"
                            : tasksError
                              ? "Could not load tasks"
                            : acTasks.length
                              ? "Select a task"
                              : "No open tasks found for this project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {filteredTasks.map((task) => (
                        <SelectItem key={task.taskId} value={String(task.taskId)}>
                          <span className="line-clamp-1">
                            #{task.taskId} — {task.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!tasksLoading && projectIdValid && acTasks.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {acTasks.length} task{acTasks.length === 1 ? "" : "s"} in project {parsedProjectId}
                    </p>
                  )}
                  {tasksError && !acNotConfigured && (
                    <p className="text-xs text-destructive">
                      {tasksErrorMessage ?? "Failed to load ActiveCollab tasks"}
                    </p>
                  )}
                </div>
              )}

              {acTaskId && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  {detailsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fetching task details & comments…
                    </div>
                  ) : detailsError ? (
                    <p className="text-destructive">Could not load task details.</p>
                  ) : acTaskDetails ? (
                    <div className="space-y-3">
                      <p className="font-medium leading-snug">{acTaskDetails.task.name}</p>
                      {acTaskDetails.task.description && (
                        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                          {acTaskDetails.task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {acTaskDetails.task.assigneeName && (
                          <span>Assignee: {acTaskDetails.task.assigneeName}</span>
                        )}
                        {acTaskDetails.task.taskUrl && (
                          <a
                            href={acTaskDetails.task.taskUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open in ActiveCollab
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <ActiveCollabCommentsList comments={displayedComments} />
                    </div>
                  ) : displayedComments.length > 0 ? (
                    <ActiveCollabCommentsList comments={displayedComments} />
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-title">Task title</Label>
              <Input
                id="task-title"
                placeholder="Auto-filled from ActiveCollab or enter manually"
                value={taskTitle}
                onChange={(e) => onTaskTitleChange(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Task description</Label>
              <Textarea
                id="task-description"
                placeholder="Acceptance criteria, user story, or QA notes…"
                value={taskDescription}
                onChange={(e) => onTaskDescriptionChange(e.target.value)}
                disabled={disabled}
                rows={4}
                className="resize-none"
              />
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Link an ActiveCollab task for richer context, or leave blank to use the PR title and
              description from GitHub.
            </p>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
