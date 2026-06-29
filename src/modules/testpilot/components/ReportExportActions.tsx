import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FileText,
  FileType,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QaReportWithMeta, TaskCommentInput } from "../types/qa-report.types";
import { formatPrNumbersLabel } from "../lib/parsePrNumbers";
import { prepareReportForDisplay } from "../lib/prepareReportForDisplay";
import type { PrepareReportOptions } from "../lib/prepareReportForDisplay";
import {
  copyReportToClipboard,
  exportReportDocx,
  exportReportJson,
  exportReportMarkdown,
  exportReportPdf,
} from "../lib/exportReport";

interface ReportExportActionsProps {
  report: QaReportWithMeta;
  onRegenerate: () => void;
  isRegenerating?: boolean;
  taskDescription?: string;
  taskComments?: TaskCommentInput[];
}

export function ReportExportActions({
  report,
  onRegenerate,
  isRegenerating,
  taskDescription = "",
  taskComments = [],
}: ReportExportActionsProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const prLabel = formatPrNumbersLabel(report.prNumbers?.length ? report.prNumbers : [report.prNumber]);
  const filename = `qa-report-${report.prNumbers?.length ? report.prNumbers.join("-") : report.prNumber}`;
  const prepareOptions: PrepareReportOptions = { taskDescription, taskComments };

  const runExport = async (key: string, fn: () => void | Promise<void>, successMsg: string) => {
    setExporting(key);
    try {
      await fn();
      toast.success(successMsg);
    } catch {
      toast.error(`Failed to export ${key.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const displayReport = prepareReportForDisplay(report, prepareOptions);
  const busy = exporting !== null;
  const changeCount = displayReport.featureSummary.changes?.length ?? 0;
  const qaFileCount = displayReport.featureSummary.qaRelevantFileCount;
  const totalFiles = displayReport.featureSummary.totalChangedFiles;
  const testCount =
    displayReport.positiveTests.length +
    displayReport.negativeTests.length +
    displayReport.edgeCases.length;

  return (
    <div className="sticky top-0 z-20 -mx-1 mb-4 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">QA Report</h2>
            <Badge variant="outline" className="font-mono text-xs">
              PR {prLabel}
            </Badge>
            {report.cached && (
              <Badge variant="secondary" className="text-xs">
                Cached
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {report.githubRepo && <span className="font-mono">{report.githubRepo}</span>}
            {changeCount > 0 && (
              <span>
                {qaFileCount != null
                  ? `${changeCount} areas · ${qaFileCount} QA files${totalFiles != null && totalFiles > qaFileCount ? ` (${totalFiles} in PR)` : ""}`
                  : `${changeCount} changes`}
              </span>
            )}
            {testCount > 0 && <span>{testCount} test cases</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || isRegenerating}
            onClick={async () => {
              try {
                await copyReportToClipboard(report, prepareOptions);
                toast.success("Report copied to clipboard");
              } catch {
                toast.error("Failed to copy report");
              }
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Markdown
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy || isRegenerating}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {busy ? "Exporting…" : "Export"}
                {!busy && <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Choose format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={busy}
                onClick={() =>
                  runExport("pdf", () => exportReportPdf(report, filename, prepareOptions), "PDF downloaded")
                }
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF (.pdf)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() =>
                  runExport(
                    "docx",
                    () => exportReportDocx(report, filename, prepareOptions),
                    "Word document downloaded",
                  )
                }
              >
                <FileType className="mr-2 h-4 w-4" />
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => {
                  exportReportMarkdown(report, filename, prepareOptions);
                  toast.success("Markdown downloaded");
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => {
                  exportReportJson(report, filename, prepareOptions);
                  toast.success("JSON downloaded");
                }}
              >
                <FileJson className="mr-2 h-4 w-4" />
                JSON (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating || busy}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
