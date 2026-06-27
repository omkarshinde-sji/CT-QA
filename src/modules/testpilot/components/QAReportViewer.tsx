import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { QaReportWithMeta } from "../types/qa-report.types";

interface QAReportViewerProps {
  report: QaReportWithMeta;
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

function TestCaseList({ items }: { items: QaReportWithMeta["positiveTests"] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No test cases generated.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((tc, index) => (
        <div key={`${tc.title}-${index}`} className="rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{tc.title}</p>
            {tc.category && <Badge variant="outline">{tc.category}</Badge>}
          </div>
          {tc.steps?.length ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {tc.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {tc.expectedResult && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Expected:</span> {tc.expectedResult}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function QAReportViewer({ report }: QAReportViewerProps) {
  const fs = report.featureSummary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Feature Summary</CardTitle>
          <CardDescription>
            PR #{report.prNumber}
            {report.githubRepo ? ` · ${report.githubRepo}` : ""}
            {report.cached ? " · Cached" : " · Fresh"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{fs.summary}</p>
          {fs.before && (
            <div>
              <p className="font-medium">Before</p>
              <p className="text-muted-foreground">{fs.before}</p>
            </div>
          )}
          {fs.after && (
            <div>
              <p className="font-medium">After</p>
              <p className="text-muted-foreground">{fs.after}</p>
            </div>
          )}
          {fs.userFlow && (
            <div>
              <p className="font-medium">User Flow</p>
              <p className="text-muted-foreground">{fs.userFlow}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["requirements", "positive", "negative", "edge"]} className="w-full">
        <AccordionItem value="requirements">
          <AccordionTrigger>Requirements ({report.requirementBreakdown.length})</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {report.requirementBreakdown.map((req, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{req.type}</Badge>
                    <p className="text-sm">{req.description}</p>
                  </div>
                  {req.acceptanceCriteria?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {req.acceptanceCriteria.map((ac, j) => (
                        <li key={j}>{ac}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="positive">
          <AccordionTrigger>Positive Test Cases ({report.positiveTests.length})</AccordionTrigger>
          <AccordionContent>
            <TestCaseList items={report.positiveTests} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="negative">
          <AccordionTrigger>Negative Test Cases ({report.negativeTests.length})</AccordionTrigger>
          <AccordionContent>
            <TestCaseList items={report.negativeTests} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="edge">
          <AccordionTrigger>Edge Cases ({report.edgeCases.length})</AccordionTrigger>
          <AccordionContent>
            <TestCaseList items={report.edgeCases} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="modules">
          <AccordionTrigger>Impacted Modules ({report.impactedModules.length})</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {report.impactedModules.map((mod, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="font-medium">{mod.moduleName}</p>
                    <p className="text-sm text-muted-foreground">{mod.reason}</p>
                  </div>
                  <Badge variant={priorityVariant[mod.testingPriority] ?? "secondary"}>
                    {mod.testingPriority}
                  </Badge>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="risks">
          <AccordionTrigger>Risk Assessment ({report.riskAssessment.length})</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {report.riskAssessment.map((risk, i) => (
                <div key={i} className="rounded-md border p-3">
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
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="regression">
          <AccordionTrigger>
            Regression Checklist ({report.regressionChecklist.length} groups)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {report.regressionChecklist.map((group, i) => (
                <div key={i}>
                  <p className="mb-2 font-medium">{group.category}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {group.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {report.onboardingSummary && (
          <AccordionItem value="onboarding">
            <AccordionTrigger>Onboarding Summary</AccordionTrigger>
            <AccordionContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {report.onboardingSummary}
              </p>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
