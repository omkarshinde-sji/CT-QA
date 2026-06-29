import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCode2,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QaReportWithMeta } from "../types/qa-report.types";
import { prepareReportForDisplay } from "../lib/prepareReportForDisplay";
import { extractClientFeedbackItems } from "../lib/clientFeedbackParser";

interface QAReportViewerProps {
  report: QaReportWithMeta;
  taskDescription?: string;
  taskComments?: Array<{ author: string; body: string; createdAt: string }>;
}

const priorityVariant: Record<string, "destructive" | "default" | "secondary"> = {
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

const severityVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  Critical: "destructive",
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

function TestCaseList({
  items,
  accent,
}: {
  items: QaReportWithMeta["positiveTests"];
  accent: "green" | "red" | "amber";
}) {
  const accentBorder = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  }[accent];

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No test cases in this category.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((tc, index) => (
        <div
          key={`${tc.title}-${index}`}
          className={`rounded-lg border border-l-4 bg-card p-4 shadow-sm ${accentBorder}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-snug">{tc.title}</p>
            {tc.category && <Badge variant="outline">{tc.category}</Badge>}
          </div>
          {tc.steps?.length ? (
            <ol className="mt-3 space-y-2">
              {tc.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {tc.expectedResult && (
            <div className="mt-3 flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                <span className="font-medium text-foreground">Expected: </span>
                {tc.expectedResult}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChangeCard({ change, index }: { change: NonNullable<QaReportWithMeta["featureSummary"]["changes"]>[number]; index: number }) {
  return (
    <div className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {index + 1}
          </span>
          <p className="text-base font-semibold">{change.area}</p>
        </div>
        {change.files?.length ? (
          <div className="flex max-w-full flex-wrap gap-1">
            {change.files.map((f) => (
              <Badge key={f} variant="secondary" className="max-w-[200px] truncate font-mono text-[10px]">
                {f}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <div className="rounded-lg border border-red-200/80 bg-gradient-to-br from-red-50/80 to-red-50/20 p-4 dark:border-red-900/50 dark:from-red-950/40 dark:to-red-950/10">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
            Before
          </p>
          <p className="text-sm leading-relaxed">{change.before}</p>
        </div>
        <div className="hidden items-center justify-center lg:flex">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="rounded-lg border border-green-200/80 bg-gradient-to-br from-green-50/80 to-green-50/20 p-4 dark:border-green-900/50 dark:from-green-950/40 dark:to-green-950/10">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
            After
          </p>
          <p className="text-sm leading-relaxed">{change.after}</p>
        </div>
      </div>

      {change.technicalNote && (
        <div className="mt-3 flex gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
          <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Technical
            </p>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              {change.technicalNote}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2 rounded-lg bg-primary/5 px-3 py-2.5 ring-1 ring-primary/10">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Verify</p>
          <p className="text-sm">{change.whatToVerify}</p>
        </div>
      </div>
    </div>
  );
}

export function QAReportViewer({ report, taskDescription = "", taskComments = [] }: QAReportViewerProps) {
  const displayReport = prepareReportForDisplay(report, { taskDescription, taskComments });
  const feedbackCount = extractClientFeedbackItems(taskDescription, taskComments).length;
  const fs = displayReport.featureSummary;
  const hasChanges = Boolean(fs.changes?.length);
  const changeCount = fs.changes?.length ?? 0;
  const totalFiles = fs.totalChangedFiles;
  const qaFileCount = fs.qaRelevantFileCount ?? new Set(
    (fs.changes ?? []).flatMap((c) => c.files ?? []),
  ).size;
  const excludedCount = fs.excludedFiles?.length ?? 0;
  const filesInChanges = new Set(
    (fs.changes ?? []).flatMap((c) => c.files ?? []),
  ).size;
  const coverageIncomplete =
    qaFileCount > 0 && filesInChanges < qaFileCount;
  const defaultTab = hasChanges ? "changes" : "tests";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 p-1">
        <TabsTrigger value="changes" className="gap-1.5 py-2 text-xs sm:text-sm">
          <Layers className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Changes</span>
          {hasChanges && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {changeCount} areas · {qaFileCount} QA files
              {feedbackCount > 0 ? ` · ${feedbackCount} AC items` : ""}
              {totalFiles != null && totalFiles > qaFileCount ? ` (${totalFiles} in PR)` : ""}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="tests" className="gap-1.5 py-2 text-xs sm:text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Tests</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
            {displayReport.positiveTests.length +
              displayReport.negativeTests.length +
              displayReport.edgeCases.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="analysis" className="gap-1.5 py-2 text-xs sm:text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Analysis</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="changes" className="mt-0 space-y-4">
        {coverageIncomplete && (
          <Alert variant="default" className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This report covers {filesInChanges} of {qaFileCount} QA-relevant files. Click{" "}
              <strong>Regenerate</strong> for a complete report.
            </AlertDescription>
          </Alert>
        )}
        {excludedCount > 0 && (
          <Alert className="border-muted bg-muted/30">
            <FileCode2 className="h-4 w-4" />
            <AlertDescription className="text-sm text-muted-foreground">
              {excludedCount} non-QA file{excludedCount > 1 ? "s" : ""} omitted from changes (e.g.{" "}
              {fs.excludedFiles!.slice(0, 3).map((f) => f.split("/").pop()).join(", ")}
              {excludedCount > 3 ? "…" : ""}) — dependency and config updates only.
            </AlertDescription>
          </Alert>
        )}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overview</CardTitle>
            <CardDescription className="text-base leading-relaxed">{fs.summary}</CardDescription>
          </CardHeader>
          {fs.userFlow && (
            <CardContent className="border-t pt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                User flow
              </p>
              <p className="whitespace-pre-wrap text-sm">{fs.userFlow}</p>
            </CardContent>
          )}
        </Card>

        {hasChanges ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Before vs After
            </h3>
            {fs.changes!.map((change, i) => (
              <ChangeCard key={i} change={change} index={i} />
            ))}
          </div>
        ) : (
          (fs.before || fs.after) && (
            <div className="grid gap-3 md:grid-cols-2">
              {fs.before && (
                <div className="rounded-xl border border-red-200/80 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
                  <p className="mb-2 text-xs font-bold uppercase text-red-700 dark:text-red-400">Before</p>
                  <p className="text-sm">{fs.before}</p>
                </div>
              )}
              {fs.after && (
                <div className="rounded-xl border border-green-200/80 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/20">
                  <p className="mb-2 text-xs font-bold uppercase text-green-700 dark:text-green-400">After</p>
                  <p className="text-sm">{fs.after}</p>
                </div>
              )}
            </div>
          )
        )}
      </TabsContent>

      <TabsContent value="tests" className="mt-0 space-y-6">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Positive tests
            <Badge variant="outline">{displayReport.positiveTests.length}</Badge>
          </h3>
          <TestCaseList items={displayReport.positiveTests} accent="green" />
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Negative tests
            <Badge variant="outline">{displayReport.negativeTests.length}</Badge>
          </h3>
          <TestCaseList items={displayReport.negativeTests} accent="red" />
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Edge cases
            <Badge variant="outline">{displayReport.edgeCases.length}</Badge>
          </h3>
          <TestCaseList items={displayReport.edgeCases} accent="amber" />
        </section>
      </TabsContent>

      <TabsContent value="analysis" className="mt-0 space-y-4">
        {displayReport.requirementBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayReport.requirementBreakdown.map((req, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{req.type}</Badge>
                    <p className="text-sm">{req.description}</p>
                  </div>
                  {req.acceptanceCriteria?.length ? (
                    <ul className="mt-2 space-y-1 pl-1">
                      {req.acceptanceCriteria.map((ac, j) => (
                        <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {ac}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {displayReport.impactedModules.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Impacted modules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {displayReport.impactedModules.map((mod, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{mod.moduleName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{mod.reason}</p>
                  </div>
                  <Badge variant={priorityVariant[mod.testingPriority] ?? "secondary"}>
                    {mod.testingPriority}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {displayReport.riskAssessment.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {displayReport.riskAssessment.map((risk, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">{risk.risk}</p>
                    <Badge variant={severityVariant[risk.severity] ?? "outline"}>
                      {risk.severity}
                    </Badge>
                  </div>
                  {risk.mitigation && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Mitigation: {risk.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {displayReport.regressionChecklist.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Regression checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayReport.regressionChecklist.map((group, i) => (
                <div key={i}>
                  <p className="mb-2 font-medium">{group.category}</p>
                  <ul className="space-y-1.5">
                    {group.items.map((item, j) => (
                      <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-muted-foreground/60">□</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {displayReport.onboardingSummary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Onboarding summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {displayReport.onboardingSummary}
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
