import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Brain,
  FileText,
  Loader2,
  ArrowRight,
  Sparkles,
  Hash,
  Clock,
  BarChart3,
} from "lucide-react";
import { useKnowledgeSearch } from "../hooks/useKnowledge";
import { formatDate, truncateText } from "@/lib/utils";

interface SemanticResult {
  id: string;
  content: string;
  similarity: number;
  metadata: {
    entity_type?: string;
    entity_id?: string;
    title?: string;
    chunk_index?: number;
    [key: string]: any;
  };
}

export default function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"text" | "semantic">("semantic");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Text-based search using existing hook
  const { data: textResults = [], isLoading: textLoading } = useKnowledgeSearch(
    searchMode === "text" ? query : ""
  );

  // Semantic search via edge function
  const semanticSearch = useMutation({
    mutationFn: async (searchQuery: string) => {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: {
          query: searchQuery,
          match_count: 20,
          match_threshold: 0.5,
        },
      });

      if (error) throw error;
      return (data?.results || []) as SemanticResult[];
    },
  });

  const handleSearch = () => {
    if (!query.trim() || query.length < 2) return;

    if (searchMode === "semantic") {
      semanticSearch.mutate(query);
    }

    // Track search history (deduplicated, last 10)
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== query);
      return [query, ...filtered].slice(0, 10);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const isLoading = searchMode === "text" ? textLoading : semanticSearch.isPending;
  const semanticResults = semanticSearch.data || [];
  const hasResults = searchMode === "text" ? textResults.length > 0 : semanticResults.length > 0;
  const hasSearched = searchMode === "text" ? query.length >= 2 : semanticSearch.isSuccess || semanticSearch.isError;

  const getSimilarityColor = (score: number) => {
    if (score >= 0.85) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 0.7) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 0.55) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.85) return "Highly Relevant";
    if (score >= 0.7) return "Relevant";
    if (score >= 0.55) return "Somewhat Relevant";
    return "Low Match";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Semantic Search
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered search across your knowledge base using vector embeddings
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/knowledge">
            <ArrowRight className="mr-2 h-4 w-4" />
            Knowledge Base
          </Link>
        </Button>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "text" | "semantic")}>
            <TabsList>
              <TabsTrigger value="semantic" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Semantic Search
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Text Search
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <CardDescription className="mt-2">
            {searchMode === "semantic"
              ? "Find content by meaning using AI embeddings. Results are ranked by semantic similarity."
              : "Find content by exact keyword matching in titles and content."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchMode === "semantic"
                    ? "Ask a question or describe what you're looking for..."
                    : "Search by keyword..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading || query.length < 2}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {searchHistory.slice(0, 5).map((h) => (
                <Badge
                  key={h}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => {
                    setQuery(h);
                    if (searchMode === "semantic") {
                      semanticSearch.mutate(h);
                    }
                  }}
                >
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {searchMode === "semantic"
                ? "Generating embedding and searching vector space..."
                : "Searching knowledge base..."}
            </p>
          </div>
        </div>
      )}

      {/* Semantic Results */}
      {searchMode === "semantic" && !isLoading && hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {semanticResults.length} Result{semanticResults.length !== 1 ? "s" : ""}
            </h2>
            {semanticResults.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>
                  Top score: {(semanticResults[0]?.similarity * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {semanticResults.length === 0 ? (
            <Card className="p-12 text-center">
              <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No semantic matches found</h3>
              <p className="text-muted-foreground">
                Try rephrasing your query or using different keywords.
                Semantic search works best with natural language questions.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {semanticResults.map((result, idx) => (
                <Card key={result.id || idx} className="hover:shadow-md transition-all">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          {result.metadata?.title ? (
                            <Link
                              to={`/knowledge/${result.metadata.entity_id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {result.metadata.title}
                            </Link>
                          ) : (
                            <span className="font-medium text-muted-foreground">
                              {result.metadata?.entity_type || "Knowledge"} chunk
                            </span>
                          )}
                          {result.metadata?.chunk_index !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              Chunk {result.metadata.chunk_index + 1}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {truncateText(result.content, 300)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${getSimilarityColor(result.similarity)}`}
                        >
                          {(result.similarity * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSimilarityLabel(result.similarity)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Text Search Results */}
      {searchMode === "text" && !textLoading && query.length >= 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {textResults.length} Result{textResults.length !== 1 ? "s" : ""}
          </h2>

          {textResults.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No results found</h3>
              <p className="text-muted-foreground">
                Try different keywords or switch to semantic search for AI-powered matching.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {textResults.map((entry) => (
                <Link key={entry.id} to={`/knowledge/${entry.id}`}>
                  <Card className="h-full hover:shadow-md transition-all">
                    <CardHeader>
                      <CardTitle className="line-clamp-2 text-base">
                        {entry.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {entry.status && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.status}
                          </Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {truncateText(entry.summary || entry.content, 150)}
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Card when no search has been performed */}
      {!hasSearched && !isLoading && query.length < 2 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Natural Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask questions in plain English. The AI understands meaning, not just keywords.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Vector Similarity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Results are ranked by how closely they match the meaning of your query.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Confidence Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each result shows a similarity score so you can assess relevance at a glance.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
