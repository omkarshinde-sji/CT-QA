import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useKnowledgeEntries,
  useKnowledgeCategories,
} from "../hooks/useKnowledge";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSyncConfluenceKnowledge,
  useSyncSharePointKnowledge,
} from "@/hooks/useIntegrationSync";
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
import {
  Plus,
  Search,
  Eye,
  FileText,
  Upload,
  TrendingUp,
  Clock,
  FolderTree,
  Sparkles,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { formatDate, truncateText } from "@/lib/utils";

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  FolderTree,
  BookOpen,
  FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
};

export default function Knowledge() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { profile } = useAuth();
  const syncConfluence = useSyncConfluenceKnowledge();
  const syncSharePoint = useSyncSharePointKnowledge();
  const canAdminSync =
    profile?.role === "admin" || profile?.role === "moderator";

  const { data: categories = [] } = useKnowledgeCategories();
  const { data: allEntries = [], isLoading } = useKnowledgeEntries({});
  const { data: filteredEntries = [] } = useKnowledgeEntries({
    search,
    category_id: selectedCategory || undefined,
  });

  // Stats calculations
  const totalEntries = allEntries.length;
  const publishedEntries = allEntries.filter((e) => e.status === "published").length;
  const totalCategories = categories.length;

  // Get recent and popular entries
  const recentlyAdded = [...allEntries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const popularEntries = [...allEntries]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 5);

  // Display entries based on search/filter
  const displayEntries = search || selectedCategory ? filteredEntries : allEntries;

  const getCategoryIcon = (iconName?: string | null) => {
    const Icon = iconName ? iconMap[iconName] || FolderTree : FolderTree;
    return Icon;
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 md:p-12">
        <div className="relative z-10 mx-auto max-w-3xl space-y-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Knowledge Base</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Discover insights, documentation, and resources powered by AI
          </p>

          {/* Search Bar */}
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for articles, guides, documentation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-14 rounded-full pl-12 pr-4 text-base shadow-lg"
            />
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold">{publishedEntries}</span>
              <span className="text-muted-foreground">Articles</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <FolderTree className="h-4 w-4 text-primary" />
              <span className="font-semibold">{totalCategories}</span>
              <span className="text-muted-foreground">Categories</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Updated daily</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link to="/knowledge/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/knowledge/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Link>
            </Button>
            {canAdminSync && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  onClick={() => syncConfluence.mutate()}
                  disabled={syncConfluence.isPending}
                >
                  {syncConfluence.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync from Confluence
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  onClick={() => syncSharePoint.mutate()}
                  disabled={syncSharePoint.isPending}
                >
                  {syncSharePoint.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync from SharePoint
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {categories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Browse by Category</h2>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Clear Filter
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.icon);
              const colorClass =
                CATEGORY_COLORS[category.color || "blue"] || "bg-blue-500";
              const entryCount = allEntries.filter(
                (e) => e.category_id === category.id
              ).length;

              return (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedCategory === category.id
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === category.id ? null : category.id
                    )
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass} text-white`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {category.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {entryCount} {entryCount === 1 ? "entry" : "entries"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  {category.description && (
                    <CardContent className="pt-0">
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {category.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recently Added Section */}
      {!search && !selectedCategory && recentlyAdded.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Recently Added</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {recentlyAdded.map((entry) => (
              <Link key={entry.id} to={`/knowledge/${entry.id}`}>
                <Card className="h-full transition-all hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-sm">
                      {entry.title}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap gap-1">
                      {entry.knowledge_categories && (
                        <Badge variant="outline" className="text-xs">
                          {entry.knowledge_categories.name}
                        </Badge>
                      )}
                      {entry.content && (
                        <span className="text-xs text-muted-foreground">
                          {Math.ceil(entry.content.split(/\s+/).length / 200)} min read
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {truncateText(entry.summary || entry.content, 100)}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Popular Section */}
      {!search && !selectedCategory && popularEntries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Most Popular</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {popularEntries.map((entry) => (
              <Link key={entry.id} to={`/knowledge/${entry.id}`}>
                <Card className="h-full transition-all hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-sm">
                      {entry.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      <span className="text-xs">{entry.view_count || 0} views</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {truncateText(entry.summary || entry.content, 100)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Entries Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">
          {search
            ? "Search Results"
            : selectedCategory
            ? "Filtered Entries"
            : "All Entries"}
        </h2>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">Loading knowledge entries...</p>
          </div>
        ) : displayEntries.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No entries found</h3>
            <p className="mb-4 text-muted-foreground">
              {search
                ? "Try adjusting your search query"
                : "Get started by adding your first knowledge entry"}
            </p>
            {!search && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/knowledge/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first entry
                </Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayEntries.map((entry) => (
              <Card key={entry.id} className="flex flex-col hover:shadow-md transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base">
                      {entry.title}
                    </CardTitle>
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    {entry.knowledge_categories && (
                      <Badge variant="outline" className="text-xs">
                        {entry.knowledge_categories.name}
                      </Badge>
                    )}
                    {entry.status && (
                      <Badge variant="secondary" className="text-xs">
                        {entry.status}
                      </Badge>
                    )}
                    {entry.content && (
                      <span className="text-xs text-muted-foreground">
                        {Math.ceil(entry.content.split(/\s+/).length / 200)} min
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {truncateText(entry.summary || entry.content, 150)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(entry.created_at)}</span>
                      {entry.view_count !== null && entry.view_count > 0 && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{entry.view_count}</span>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/knowledge/${entry.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        View Article
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
