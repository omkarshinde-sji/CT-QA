import { Link, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { usePageIndex, searchPageIndex } from "@/hooks/usePageIndex";
import { SpaceSwitcher } from "@/components/layout/SpaceSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  User,
  Settings,
  Search,
  FileText,
  Users,
  Calendar,
  Loader2,
  LayoutGrid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { useMemo, useState } from "react";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopNav() {
  const { user, profile, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const { features, isFeatureEnabled } = useFeatureFlags();
  const fourSpaces = features?.enableFourSpaces === true;
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"pages" | "content">("pages");
  const pageIndex = usePageIndex();
  const notificationsPath = fourSpaces ? "/operations/notifications" : "/notifications";

  const {
    query: searchQuery,
    results: searchResults,
    isSearching: searching,
    search,
    clearResults,
    setQuery: setSearchQuery,
  } = useSemanticSearch();

  const pageResults = useMemo(
    () => searchPageIndex(pageIndex, searchQuery),
    [pageIndex, searchQuery]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchTab === "content") {
      await search(searchQuery);
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "knowledge":
        return <FileText className="h-4 w-4" />;
      case "client":
        return <Users className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      // Force navigation to login regardless of auth state propagation timing
      window.location.href = "/login";
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setSearchTab(fourSpaces ? "pages" : "content");
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger className="shrink-0" />
          {fourSpaces && <SpaceSwitcher />}
        </div>

        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={fourSpaces ? "Search pages and content…" : "Search anything..."}
            onClick={openSearch}
            readOnly
            className="h-9 w-full max-w-sm border-transparent bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground/70 focus:border-border focus:bg-background cursor-pointer"
          />
        </div>

        <Dialog
          open={searchOpen}
          onOpenChange={(open) => {
            setSearchOpen(open);
            if (!open) clearResults();
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Search</DialogTitle>
              <DialogDescription>
                {fourSpaces
                  ? "Find pages across spaces or search content"
                  : "Search across clients, meetings, knowledge base, and more"}
              </DialogDescription>
            </DialogHeader>

            {fourSpaces ? (
              <Tabs value={searchTab} onValueChange={(v) => setSearchTab(v as "pages" | "content")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pages">Pages</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>
                <div className="mt-4">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What are you looking for?"
                    autoFocus
                  />
                </div>
                <TabsContent value="pages" className="mt-4 max-h-[400px] overflow-y-auto space-y-1">
                  {!searchQuery.trim() ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Type to search navigation pages
                    </p>
                  ) : pageResults.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No pages found</p>
                  ) : (
                    pageResults.map((result) => (
                      <button
                        key={result.href}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:bg-accent"
                        onClick={() => {
                          navigate(result.href);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{result.title}</p>
                          <p className="text-xs text-muted-foreground">{result.breadcrumb}</p>
                        </div>
                      </button>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="content" className="mt-4">
                  <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                    <Button type="submit" disabled={searching || !searchQuery.trim()}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto">
                    {searching ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchResults.length === 0 && searchQuery ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No results found</p>
                    ) : (
                      searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent"
                          onClick={() => {
                            setSearchOpen(false);
                            clearResults();
                          }}
                        >
                          <div className="mt-0.5">{getEntityIcon(result.entity_type)}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {result.entity_type}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {Math.round(result.similarity * 100)}% match
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm">{result.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="What are you looking for?"
                      disabled={searching}
                      autoFocus
                    />
                    <Button type="submit" disabled={searching || !searchQuery.trim()}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
                <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
                  {searching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 && searchQuery ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <Search className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No results found</p>
                    </div>
                  ) : (
                    searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent"
                        onClick={() => {
                          setSearchOpen(false);
                          clearResults();
                        }}
                      >
                        <div className="mt-0.5">{getEntityIcon(result.entity_type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {result.entity_type}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(result.similarity * 100)}% match
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm">{result.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-1">
          {isFeatureEnabled("enableNotifications") && hasPermission("notifications.view") && (
            <NotificationBell notificationsPath={notificationsPath} />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-2 pr-3 hover:bg-muted">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {getInitials(profile?.full_name || user?.email || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-sm font-medium text-foreground">
                    {profile?.full_name || "User"}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {!fourSpaces &&
                (hasPermission("settings.admin") ||
                  profile?.role === "admin" ||
                  profile?.role === "moderator") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2 font-medium text-orange-600 dark:text-orange-400">
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
