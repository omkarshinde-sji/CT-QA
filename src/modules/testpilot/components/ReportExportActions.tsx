import { Copy, Download, FileJson, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { QaReportWithMeta } from "../types/qa-report.types";
import {
  copyReportToClipboard,
  exportReportJson,
  exportReportMarkdown,
} from "../lib/exportReport";

interface ReportExportActionsProps {
  report: QaReportWithMeta;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

export function ReportExportActions({
  report,
  onRegenerate,
  isRegenerating,
}: ReportExportActionsProps) {
  const filename = `qa-report-pr-${report.prNumber}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await copyReportToClipboard(report);
            toast.success("Report copied to clipboard");
          } catch {
            toast.error("Failed to copy report");
          }
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy Markdown
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportReportJson(report, filename)}>
        <FileJson className="mr-2 h-4 w-4" />
        Export JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportReportMarkdown(report, filename)}>
        <Download className="mr-2 h-4 w-4" />
        Export Markdown
      </Button>
      <Button variant="secondary" size="sm" onClick={onRegenerate} disabled={isRegenerating}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
        Regenerate
      </Button>
    </div>
  );
}
