import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingContext";
import { useSpace } from "@/contexts/SpaceContext";
import { useSpaceAccess } from "@/hooks/useSpaceAccess";
import { useSpacePreferences } from "@/hooks/useSpacePreferences";
import { useDealPipelineStats } from "@/modules/business-dev/hooks/useDeals";
import { spaceNavigation, type SpaceNavItem, type SpaceNavGroup } from "@/shared/data/spaceNavigation";
import { SPACE_REGISTRY } from "@/shared/config/spaces";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AIIndicator } from "@/components/ui/ai-indicator";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  BookOpen,
  BookMarked,
  Brain,
  Bot,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  Target,
  FolderKanban,
  BarChart3,
  GitBranch,
  Crosshair,
  Eye,
  AlertCircle,
  Repeat,
  Handshake,
  Contact,
  FileText,
  Briefcase,
  ListTodo,
  Settings2,
  Sparkles,
  ScrollText,
  Network,
  Search,
  HelpCircle,
  ClipboardCheck,
  Building2,
  Shield,
  Activity,
  Layers,
  Bell,
  Zap,
  Plug,
  Palette,
  Mail,
  Star,
  Clock,
  FlaskConical,
  Database,
  Cpu,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  BookOpen,
  BookMarked,
  Brain,
  Bot,
  MessageSquare,
  MessageCircle,
  Target,
  FolderKanban,
  BarChart3,
  GitBranch,
  Crosshair,
  Eye,
  AlertCircle,
  Repeat,
  Handshake,
  Contact,
  FileText,
  Briefcase,
  ListTodo,
  Settings2,
  Sparkles,
  ScrollText,
  Network,
  Search,
  HelpCircle,
  ClipboardCheck,
  Building2,
  Shield,
  Activity,
  Layers,
  Bell,
  Zap,
  Plug,
  Palette,
  Mail,
  Star,
  Clock,
  FlaskConical,
  Database,
  Cpu,
  FolderOpen,
};

function resolveIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

function menuStateKey(spaceId: string) {
  return `sidebar-menu-state:${spaceId}`;
}

export function SpaceSidebar() {
  const location = useLocation();
  const { open } = useSidebar();
  const { companyName } = useBranding();
  const { currentSpace } = useSpace();
  const { isNavItemVisible, isNavGroupVisible } = useSpaceAccess({ context: "space" });
  const { favorites, recentPages, toggleFavorite, isFavorite } = useSpacePreferences();
  const { data: dealStats } = useDealPipelineStats();
  const dealStageCounts = dealStats?.by_stage ?? {};
  const spaceDef = SPACE_REGISTRY[currentSpace];
  const groups = spaceNavigation[currentSpace] ?? [];

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(menuStateKey(currentSpace));
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(menuStateKey(currentSpace), JSON.stringify(openMenus));
    } catch {
      // ignore
    }
  }, [openMenus, currentSpace]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isRouteActive = (href: string): boolean => {
    const path = href.split("?")[0];
    if (location.pathname !== path && !location.pathname.startsWith(path + "/")) return false;
    if (href.includes("?")) {
      const params = new URLSearchParams(href.split("?")[1]);
      const current = new URLSearchParams(location.search);
      return Array.from(params.entries()).every(([k, v]) => current.get(k) === v);
    }
    if (href.includes("/sales/deals") && location.pathname === "/sales/deals") {
      const tab = new URLSearchParams(location.search).get("tab");
      const stage = new URLSearchParams(location.search).get("stage");
      return (tab == null || tab === "" || tab === "overview" || tab === "all") &&
        (stage == null || stage === "" || stage === "all");
    }
    return true;
  };

  const visibleGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    const itemMatches = (item: SpaceNavItem) => {
      if (!q) return true;
      if (item.title.toLowerCase().includes(q)) return true;
      return (item.children ?? []).some((c) => c.title.toLowerCase().includes(q));
    };
    return groups
      .filter(isNavGroupVisible)
      .map((group) => ({
        ...group,
        items: group.items.filter(isNavItemVisible).filter(itemMatches),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, isNavGroupVisible, isNavItemVisible, sidebarSearch]);

  const spaceFavorites = favorites.filter((f) => f.spaceId === currentSpace);
  const spaceRecents = recentPages.filter((r) => r.spaceId === currentSpace);

  const renderNavItem = (item: SpaceNavItem, group: SpaceNavGroup) => {
    const Icon = resolveIcon(item.icon);
    const children = item.children?.filter(isNavItemVisible).filter((child) => {
      const q = sidebarSearch.trim().toLowerCase();
      if (!q) return true;
      return child.title.toLowerCase().includes(q);
    }) ?? [];
    const hasChildren = children.length > 0;
    const itemKey = `${group.id}-${item.title}`;
    const childActive = children.some((c) => isRouteActive(c.href));
    const isOpen = openMenus[itemKey] ?? (childActive || item.headerOnly === true);
    const favorited = isFavorite(item.href);

    if (hasChildren) {
      return (
        <Collapsible
          key={itemKey}
          open={isOpen}
          onOpenChange={() => toggleMenu(itemKey)}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={!item.headerOnly && isRouteActive(item.href)}
              >
                <Icon />
                <span>{item.title}</span>
                <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {children.map((child) => {
                  const ChildIcon = resolveIcon(child.icon);
                  const isDealsSection = item.href.includes("/deals");
                  const badge =
                    isDealsSection && child.href === item.href.split("?")[0]
                      ? dealStats?.total_deals != null
                        ? String(dealStats.total_deals)
                        : child.badge
                      : child.badge;
                  return (
                    <SidebarMenuSubItem key={child.href}>
                      <SidebarMenuSubButton asChild isActive={isRouteActive(child.href)}>
                        <Link to={child.href}>
                          <ChildIcon />
                          <span>{child.title}</span>
                          {badge != null && (
                            <span className="ml-auto text-xs text-muted-foreground">{badge}</span>
                          )}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isRouteActive(item.href)} tooltip={item.title}>
          <Link to={item.href}>
            <Icon />
            <span>{item.title}</span>
            <button
              type="button"
              className="ml-auto opacity-0 group-hover/menu-item:opacity-100 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite({
                  title: item.title,
                  href: item.href,
                  spaceId: currentSpace,
                  icon: item.icon,
                });
              }}
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
            >
              <Star
                className={cn("h-3.5 w-3.5", favorited && "fill-amber-400 text-amber-400")}
              />
            </button>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border",
          open ? "p-4" : "p-0 h-12 flex items-center justify-center"
        )}
      >
        <Link
          to={spaceDef.dashboardPath}
          className={cn("flex items-center gap-3", !open && "justify-center")}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          {open && (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">
                {spaceDef.label} Space
              </span>
              <span className="text-xs text-muted-foreground truncate">{companyName}</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {open && (
          <SidebarGroup className="py-2">
            <div className="px-2">
              <Input
                placeholder="Filter menu…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </SidebarGroup>
        )}

        {spaceFavorites.length > 0 && !sidebarSearch.trim() && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" /> Favorites
            </SidebarGroupLabel>
            <SidebarMenu>
              {spaceFavorites.map((fav) => {
                const Icon = resolveIcon(fav.icon);
                return (
                  <SidebarMenuItem key={fav.href}>
                    <SidebarMenuButton asChild isActive={isRouteActive(fav.href)} tooltip={fav.title}>
                      <Link to={fav.href}>
                        <Icon />
                        <span>{fav.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {spaceRecents.length > 0 && !sidebarSearch.trim() && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent
            </SidebarGroupLabel>
            <SidebarMenu>
              {spaceRecents.slice(0, 5).map((recent) => (
                <SidebarMenuItem key={recent.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive(recent.href)}
                    tooltip={recent.title}
                  >
                    <Link to={recent.href}>
                      <Clock className="h-4 w-4" />
                      <span className="truncate">{recent.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {(spaceFavorites.length > 0 || spaceRecents.length > 0) && !sidebarSearch.trim() && (
          <SidebarSeparator />
        )}

        {visibleGroups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              {group.title}
              {group.isAI && <AIIndicator variant="dot" size="sm" />}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{group.items.map((item) => renderNavItem(item, group))}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isRouteActive("/help")} tooltip="Help & Guides">
                <Link to="/help">
                  <HelpCircle />
                  <span>Help & Guides</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {open && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="rounded-lg bg-sidebar-accent/50 px-4 py-3">
            <p className="text-sm font-medium text-sidebar-foreground">{spaceDef.label}</p>
            <p className="text-xs text-muted-foreground">Four Spaces IA</p>
          </div>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
