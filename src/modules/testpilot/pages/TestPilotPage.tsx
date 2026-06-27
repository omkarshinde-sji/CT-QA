import { useState } from "react";
import { FlaskConical, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskPrPicker } from "../components/TaskPrPicker";
import { QAReportViewer } from "../components/QAReportViewer";
import { ReportExportActions } from "../components/ReportExportActions";
import { useGenerateTestPilotReport } from "../hooks/useTestPilot";
import { useQAReports } from "../hooks/useQAReports";
import type { QaReportWithMeta } from "../types/qa-report.types";

export default function TestPilotPage() {
  const [taskId, setTaskId] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [repoOverride, setRepoOverride] = useState("");
  const [report, setReport] = useState<QaReportWithMeta | null>(null);

  const generate = useGenerateTestPilotReport();
  const { data: history = [], isLoading: historyLoading } = useQAReports(taskId || undefined);

  const handleGenerate = (regenerate = false) => {
    const pr = Number(prNumber);
    if (!taskId) return;
    if (!pr || pr < 1) return;

    generate.mutate(
      {
        taskId,
        prNumber: pr,
        regenerate,
        repo: repoOverride.trim() || undefined,
      },
      {
        onSuccess: (data) => setReport(data),
      },
    );
  };

  const canGenerate = Boolean(taskId && prNumber && Number(prNumber) > 0);

  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <FlaskConical className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TestPilot AI</h1>
          <p className="text-muted-foreground">
            Generate focused QA intelligence from a task and GitHub PR — so testers know exactly
            what changed and what to verify.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate QA Report</CardTitle>
          <CardDescription>
            Select the task, enter the PR number, and TestPilot will analyze the diff and produce
            test scenarios, risks, and a regression checklist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskPrPicker
            taskId={taskId}
            prNumber={prNumber}
            repoOverride={repoOverride}
            onTaskIdChange={setTaskId}
            onPrNumberChange={setPrNumber}
            onRepoOverrideChange={setRepoOverride}
            disabled={generate.isPending}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleGenerate(false)}
              disabled={!canGenerate || generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Report
            </Button>
          </div>

          {generate.isError && (
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>
                {(generate.error as Error)?.message ||
                  "Check GitHub secrets (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO) and try again."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {generate.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Analyzing PR changes...</CardTitle>
            <CardDescription>
              Fetching task context, GitHub diff, and generating QA intelligence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {!generate.isPending && !report && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FlaskConical className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No report yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Select a task and PR number, then click Generate Report to create a QA brief for
              testers.
            </p>
          </CardContent>
        </Card>
      )}

      {report && !generate.isPending && (
        <div className="space-y-4">
          <ReportExportActions
            report={report}
            onRegenerate={() => handleGenerate(true)}
            isRegenerating={generate.isPending}
          />
          <QAReportViewer report={report} />
        </div>
      )}

      {taskId && (
        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>Previously generated reports for this task</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous reports for this task.</p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => setReport(item)}
                  >
                    <span>
                      PR #{item.prNumber} — {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {item.featureSummary.summary.length > 80
                        ? `${item.featureSummary.summary.slice(0, 80)}…`
                        : item.featureSummary.summary}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
