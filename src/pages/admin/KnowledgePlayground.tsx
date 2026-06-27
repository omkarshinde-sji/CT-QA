import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FlaskConical, Save } from "lucide-react";
import { useKbRagPlayground } from "@/hooks/useKbRagPlayground";
import { useKbSourceConfigs } from "@/hooks/useKbSourceConfig";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function KnowledgePlayground() {
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const playground = useKbRagPlayground();
  const { data: sources } = useKbSourceConfigs();
  const result = playground.data;

  const runQuery = (saveRun = false, saveTest = false) => {
    if (!query.trim()) return;
    playground.mutate({
      query: query.trim(),
      source_id: sourceId || undefined,
      save_run: saveRun,
      save_test_case: saveTest,
      expected_answer: expectedAnswer || undefined,
    });
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FlaskConical className="h-8 w-8 text-primary" />
          RAG Playground
        </h1>
        <p className="text-muted-foreground mt-1">Inspect retrieval quality and evaluate RAG responses</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Query</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-3 space-y-2">
              <Label>Search Query</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter a test query..." />
            </div>
            <div className="space-y-2">
              <Label>Source (optional)</Label>
              <Select value={sourceId || "__all__"} onValueChange={(v) => setSourceId(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sources</SelectItem>
                  {(sources ?? []).map(({ source }) => (
                    <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Expected Answer (for test cases)</Label>
            <Textarea value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => runQuery()} disabled={playground.isPending}>
              {playground.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Run Query
            </Button>
            <Button variant="outline" onClick={() => runQuery(true, true)} disabled={playground.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Evaluation
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Retrieval", value: `${result.metrics.retrieval_latency_ms}ms` },
              { label: "Rerank", value: `${result.metrics.rerank_latency_ms}ms` },
              { label: "Generation", value: `${result.metrics.generation_latency_ms}ms` },
              { label: "Total Cost", value: `$${result.metrics.total_cost.toFixed(6)}` },
            ].map((m) => (
              <Card key={m.label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{m.label}</p><p className="text-xl font-bold">{m.value}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Retrieved Chunks</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Similarity</TableHead>
                    <TableHead>Rerank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.retrieved_chunks.map((c) => (
                    <TableRow key={c.chunk_id}>
                      <TableCell className="max-w-md truncate">{c.content}</TableCell>
                      <TableCell><Badge variant="outline">{c.source}</Badge></TableCell>
                      <TableCell>{c.similarity_score.toFixed(3)}</TableCell>
                      <TableCell>{c.rerank_score?.toFixed(3) ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {result.answer && (
            <Card>
              <CardHeader><CardTitle>Generated Answer</CardTitle><CardDescription>Sources: {result.citations.map((c) => `[${c.index}]`).join(", ")}</CardDescription></CardHeader>
              <CardContent><p className="whitespace-pre-wrap">{result.answer}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
