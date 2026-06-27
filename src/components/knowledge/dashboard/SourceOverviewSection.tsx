import { Link } from "react-router-dom";
import { useKnowledgeSourcesOverview } from "@/modules/knowledge/hooks/useKnowledgeDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Database,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function sourceHealth(source: {
  is_active: boolean | null;
  sync_status?: string;
  last_synced_at: string | null;
}): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (source.sync_status === "failed") return { label: "Failed", variant: "destructive" };
  if (!source.is_active) return { label: "Inactive", variant: "outline" };
  if (source.sync_status === "syncing" || source.sync_status === "pending") {
    return { label: "Syncing", variant: "secondary" };
  }
  if (source.last_synced_at) return { label: "Healthy", variant: "default" };
  return { label: "Not synced", variant: "outline" };
}

const INTEGRATION_LINKS = [
  { label: "Integration Preferences", href: "/admin/integrations#preferences" },
  { label: "Google Drive", href: "/admin/integrations/google-drive" },
  { label: "Confluence", href: "/admin/integrations/confluence" },
  { label: "SharePoint", href: "/admin/integrations/sharepoint" },
  { label: "All Integrations", href: "/admin/integrations" },
];

export function SourceOverviewSection() {
  const { data, isLoading } = useKnowledgeSourcesOverview();
  const sources = data?.sources ?? [];

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Source Overview</h2>
        <p className="text-sm text-muted-foreground">Read-only view of connected knowledge sources</p>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertTitle>Manage Knowledge Sources in Integrations</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Source configuration, OAuth connections, and sync triggers are managed from the Integrations module.
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEGRATION_LINKS.map((link) => (
              <Button key={link.href} variant="outline" size="sm" asChild>
                <Link to={link.href}>
                  {link.label}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Connected Sources</CardTitle>
          <CardDescription>
            {sources.length} source{sources.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No knowledge sources configured yet.</p>
              <Button variant="link" asChild className="mt-2">
                <Link to="/admin/integrations">Set up integrations</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => {
                  const health = sourceHealth(source);
                  return (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{source.source_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={health.variant} className="flex items-center gap-1 w-fit">
                          {health.label === "Healthy" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : health.label === "Failed" ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {health.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{source.sync_status ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>{source.file_count ?? 0}</TableCell>
                      <TableCell>
                        {source.last_synced_at
                          ? formatDateTime(source.last_synced_at)
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
