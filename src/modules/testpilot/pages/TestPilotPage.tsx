import {
  Clock,
  FlaskConical,
  GitPullRequest,
  History,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/lib/componentOptimization";
import { TaskPrPicker } from "../components/TaskPrPicker";
import { QAReportViewer } from "../components/QAReportViewer";
import { ReportExportActions } from "../components/ReportExportActions";
import { TestPilotChatLauncher } from "../components/TestPilotChatPanel";
import { useGenerateTestPilotReport } from "../hooks/useTestPilot";
import { useQAReports } from "../hooks/useQAReports";
import { useTestPilotFormState } from "../hooks/useTestPilotFormState";
import { isValidGithubRepo, normalizeGithubRepo } from "../lib/normalizeGithubRepo";
import { formatPrNumbersLabel } from "../lib/parsePrNumbers";
import type { QaReportWithMeta } from "../types/qa-report.types";

const LOADING_STEPS = [
  "Fetching PR diff from GitHub",
  "Analyzing changed files",
  "Building before/after summary",
  "Generating test cases",
];

export default function TestPilotPage() {
  const {
    taskTitle,
    taskDescription,
    prNumbers,
    repoOverride,
    acProjectId,
    acTaskId,
    acTaskComments,
    report,
    setTaskTitle,
    setTaskDescription,
    addPrNumber,
    removePrNumber,
    setRepoOverride,
    setAcProjectId,
    setAcTaskId,
    applyActiveCollabContext,
    setReport,
  } = useTestPilotFormState();

  const generate = useGenerateTestPilotReport();
  const normalizedRepo = normalizeGithubRepo(repoOverride) ?? "";

  const debouncedRepo = useDebouncedValue(normalizedRepo, 400);
  const debouncedPrKey = useDebouncedValue(prNumbers.join(","), 400);
  const debouncedPrNumbers = debouncedPrKey
    ? debouncedPrKey.split(",").map(Number).filter((n) => n > 0)
    : [];

  const { data: history = [], isPending: historyPending } = useQAReports({
    repo: debouncedRepo || undefined,
    prNumbers: debouncedPrNumbers.length ? debouncedPrNumbers : undefined,
  });

  const handleGenerate = (regenerate = false) => {
    if (!prNumbers.length) return;
    if (!normalizedRepo) return;

    generate.mutate(
      {
        prNumbers,
        regenerate,
        repo: normalizedRepo,
        taskTitle: taskTitle.trim() || undefined,
        taskDescription: taskDescription.trim() || undefined,
        taskComments: acTaskComments.length ? acTaskComments : undefined,
        activeCollabProjectId: acProjectId ? Number(acProjectId) : undefined,
        activeCollabTaskId: acTaskId ? Number(acTaskId) : undefined,
      },
      {
        onSuccess: (data: QaReportWithMeta) => setReport(data),
      },
    );
  };

  const canGenerate = Boolean(prNumbers.length > 0 && isValidGithubRepo(repoOverride));
  const showHistory = Boolean(debouncedRepo && debouncedPrNumbers.length > 0);
  const showHistorySkeleton = showHistory && historyPending && history.length === 0;
  const isInitialGenerate = generate.isPending && !report;

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="container relative max-w-6xl py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="ai-glow-sm flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20">
                <FlaskConical className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">TestPilot AI</h1>
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    QA Copilot
                  </Badge>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                  Turn any GitHub PR into a clear QA brief — before/after changes, test cases, and
                  risks in plain English.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-6">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left: Form */}
          <div className="space-y-4 lg:col-span-4 lg:sticky lg:top-6">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <CardTitle className="text-lg">New QA Report</CardTitle>
                <CardDescription>Connect a PR and generate your test brief</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <TaskPrPicker
                  taskTitle={taskTitle}
                  taskDescription={taskDescription}
                  prNumbers={prNumbers}
                  repoOverride={repoOverride}
                  acProjectId={acProjectId}
                  acTaskId={acTaskId}
                  acTaskComments={acTaskComments}
                  onTaskTitleChange={setTaskTitle}
                  onTaskDescriptionChange={setTaskDescription}
                  onAddPrNumber={addPrNumber}
                  onRemovePrNumber={removePrNumber}
                  onRepoOverrideChange={setRepoOverride}
                  onAcProjectIdChange={setAcProjectId}
                  onAcTaskIdChange={setAcTaskId}
                  onActiveCollabContextLoaded={applyActiveCollabContext}
                  disabled={generate.isPending}
                />

                <Button
                  className="w-full h-11 text-base shadow-sm"
                  size="lg"
                  onClick={() => handleGenerate(false)}
                  disabled={!canGenerate || generate.isPending}
                >
                  {generate.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-5 w-5" />
                  )}
                  {generate.isPending ? "Generating…" : "Generate QA Report"}
                </Button>

                {!canGenerate && (repoOverride || prNumbers.length > 0) && (
                  <p className="text-center text-xs text-muted-foreground">
                    Enter a valid repo and at least one PR number to continue
                  </p>
                )}

                {generate.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>Generation failed</AlertTitle>
                    <AlertDescription className="text-sm">
                      {(generate.error as Error)?.message ||
                        "Check GITHUB_TOKEN in Supabase secrets and repo access."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {showHistory && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    History
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {debouncedRepo} · PR {formatPrNumbersLabel(debouncedPrNumbers)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {showHistorySkeleton ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No previous reports yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="group flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                          onClick={() => setReport(item)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                            {item.cached && (
                              <Badge variant="outline" className="text-[10px]">
                                cached
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm group-hover:text-foreground">
                            {item.featureSummary.summary}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-8">
            {isInitialGenerate && (
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Analyzing PR changes
                  </CardTitle>
                  <CardDescription>This usually takes 15–30 seconds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {LOADING_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                      {i === 0 && <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />}
                    </div>
                  ))}
                  <div className="space-y-2 pt-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </CardContent>
              </Card>
            )}

            {!report && !generate.isPending && (
              <Card className="overflow-hidden border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center px-6 py-16 text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border">
                    <GitPullRequest className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold">Your QA report will appear here</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Fill in the repo and PR on the left, then hit Generate. TestPilot will explain
                    what changed and what to test.
                  </p>
                  <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-3">
                    {[
                      { step: "1", label: "Paste repo URL" },
                      { step: "2", label: "Add PR #s" },
                      { step: "3", label: "Generate" },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="rounded-lg border bg-muted/20 px-3 py-4 text-center"
                      >
                        <p className="text-lg font-bold text-primary">{item.step}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {report && (
              <div className="relative">
                {generate.isPending && (
                  <div className="absolute inset-0 z-30 flex items-start justify-center rounded-xl bg-background/70 pt-16 backdrop-blur-sm">
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-5 py-3 shadow-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">Regenerating report…</span>
                    </div>
                  </div>
                )}
                <ReportExportActions
                  report={report}
                  onRegenerate={() => handleGenerate(true)}
                  isRegenerating={generate.isPending}
                  taskDescription={taskDescription}
                  taskComments={acTaskComments}
                />
                <QAReportViewer
                  report={report}
                  taskDescription={taskDescription}
                  taskComments={acTaskComments}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {canGenerate && (
        <TestPilotChatLauncher
          repo={normalizedRepo}
          prNumbers={prNumbers}
          report={report}
          taskTitle={taskTitle}
          taskDescription={taskDescription}
          taskComments={acTaskComments}
          activeCollabProjectId={acProjectId ? Number(acProjectId) : undefined}
          activeCollabTaskId={acTaskId ? Number(acTaskId) : undefined}
        />
      )}
    </div>
  );
}
