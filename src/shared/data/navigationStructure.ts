/**
 * Navigation Structure
 *
 * Single source of truth for all navigation items across the application.
 * Both AppSidebar and AdminSidebar read from this file.
 *
 * Items are filtered at runtime based on:
 * - Module access (useModuleAccess)
 * - Feature flags (useFeatureFlags)
 * - User role
 */

import type { ModuleId } from "@/shared/config/modules";

/**
 * Agency roles that can see a nav item or group.
 * When omitted the item is visible to all roles.
 */
export type AgencyRole = "owner" | "pm" | "ic" | "bd";

export interface NavItem {
  title: string;
  href: string;
  icon: string; // lucide icon name — resolved in the sidebar component
  module?: ModuleId; // Module that must be enabled for this item to appear
  featureFlag?: string; // Legacy feature flag check
  adminOnly?: boolean;
  badge?: string;
  children?: NavItem[]; // Nested sub-items (e.g., Streams under Tasks)
  /** When true, parent is rendered as a section header only (collapsible), not a link; children are the links */
  headerOnly?: boolean;
  /** When set, only these agency roles see the item. Admins always see everything. */
  agencyRoles?: AgencyRole[];
  /** When true, only visible if user.isEosUser === true */
  eosOnly?: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  icon: string;
  isAI?: boolean; // Shows AI indicator animation
  module?: ModuleId;
  featureFlag?: string;
  items: NavItem[];
  /** When set, only these agency roles see the group. Admins always see everything. */
  agencyRoles?: AgencyRole[];
  /** When true, only visible if user.isEosUser === true */
  eosOnly?: boolean;
}

/**
 * Dashboard - Always visible at top level
 */
export const dashboardItem: NavItem = {
  title: "Dashboard",
  href: "/dashboard",
  icon: "LayoutDashboard",
};

/**
 * Main application navigation - Grouped structure
 */
export const navigationGroups: NavGroup[] = [
  {
    id: "ai-browse",
    title: "AI Agents",
    icon: "Sparkles",
    isAI: true,
    items: [
      {
        title: "Browse Agents",
        href: "/agents",
        icon: "Bot",
        featureFlag: "enableAIAgents",
      },
      {
        title: "My AI Chat",
        href: "/ai-agents",
        icon: "MessageSquare",
        featureFlag: "enableAIAgents",
      },
    ],
  },
  {
    id: "business-dev",
    title: "Sales Hub",
    icon: "Briefcase",
    module: "business-dev",
    items: [
      {
        title: "Companies",
        href: "/clients",
        icon: "Building2",
        module: "business-dev",
        featureFlag: "enableClients",
      },
      {
        title: "Contacts",
        href: "/contacts",
        icon: "Contact",
        module: "business-dev",
        featureFlag: "enableClients",
      },
      {
        title: "Business Opportunities",
        href: "/deals",
        icon: "Handshake",
        module: "business-dev",
        featureFlag: "enableClients",
        headerOnly: true,
        children: [
          { title: "Deals Dashboard", href: "/deals?tab=overview", icon: "LayoutDashboard", module: "business-dev", featureFlag: "enableClients" },
          { title: "All Deals", href: "/deals", icon: "LayoutDashboard", module: "business-dev", featureFlag: "enableClients" },
        ],
      },
      {
        title: "Lead Follow-Up",
        href: "/lead-followup",
        icon: "Target",
        module: "lead-followup",
      },
    ],
  },
  {
    id: "work-management",
    title: "Work Management",
    icon: "ListTodo",
    items: [
      {
        title: "Tasks",
        href: "/tasks",
        icon: "CheckSquare",
        module: "actions",
        featureFlag: "enableTasks",
      },
      {
        title: "Projects",
        href: "/projects",
        icon: "FolderKanban",
        module: "projects",
      },
    ],
  },
  {
    id: "meetings",
    title: "Meetings",
    icon: "Calendar",
    module: "meetings",
    items: [
      {
        title: "All Meetings",
        href: "/meetings/schedule",
        icon: "Calendar",
        module: "meetings",
        featureFlag: "enableMeetings",
      },
      {
        title: "Transcripts",
        href: "/meetings/transcripts",
        icon: "ScrollText",
        module: "meetings",
        featureFlag: "enableMeetings",
      },
    ],
  },
  {
    id: "knowledge",
    title: "Knowledge",
    icon: "BookOpen",
    module: "knowledge",
    items: [
      {
        title: "Knowledge Base",
        href: "/knowledge",
        icon: "BookOpen",
        module: "knowledge",
        featureFlag: "enableKnowledgeBase",
      },
      {
        title: "Personal Library",
        href: "/personal-knowledge",
        icon: "BookMarked",
        module: "knowledge",
        featureFlag: "enablePersonalKnowledge",
      },
    ],
  },
  {
    id: "strategy",
    title: "Strategy (EOS)",
    icon: "Target",
    module: "eos",
    eosOnly: true, // Only shown to EOS-enabled users
    agencyRoles: ["owner"],
    items: [
      {
        title: "EOS Hub",
        href: "/eos",
        icon: "Target",
        module: "eos",
      },
      {
        title: "V/TO",
        href: "/eos/vto",
        icon: "Eye",
        module: "eos",
      },
      {
        title: "OKRs",
        href: "/okrs",
        icon: "Crosshair",
        module: "eos",
      },
      {
        title: "Issues",
        href: "/eos/issues",
        icon: "AlertCircle",
        module: "eos",
      },
      {
        title: "Scorecard",
        href: "/eos/scorecard",
        icon: "BarChart3",
        module: "eos",
      },
      {
        title: "Accountability",
        href: "/eos/accountability",
        icon: "Network",
        module: "eos",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: "Settings2",
    agencyRoles: ["owner", "pm"], // ICs don't need operations
    items: [
      {
        title: "Productivity",
        href: "/productivity",
        icon: "BarChart3",
        module: "productivity",
      },
      {
        title: "Processes",
        href: "/process",
        icon: "FileText",
        module: "productivity",
      },
      {
        title: "Feedback",
        href: "/feedback",
        icon: "MessageCircle",
        featureFlag: "enableFeedback",
      },
      {
        title: "Automation",
        href: "/automation/workflows",
        icon: "GitBranch",
        module: "automation",
        featureFlag: "enableAutomations",
      },
      {
        title: "TestPilot AI",
        href: "/testpilot",
        icon: "FlaskConical",
        module: "testpilot",
        featureFlag: "enableTestPilot",
      },
    ],
  },
];

/**
 * Legacy flat navigation - maintained for backward compatibility
 * @deprecated Use navigationGroups instead
 */
export const mainNavigation: NavItem[] = [
  dashboardItem,
  ...navigationGroups.flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.children || [])])
  ),
];

/**
 * Admin panel navigation (admin sidebar)
 */
export const adminNavigation: NavGroup[] = [
  {
    id: "admin-dashboard",
    title: "PEOPLE & PERFORMANCE",
    icon: "LayoutDashboard",
    items: [
      {
        title: "Admin Dashboard",
        href: "/admin",
        icon: "LayoutDashboard",
      },
      {
        title: "OKR & Scorecards",
        href: "/admin/eos/scorecards",
        icon: "Target",
        headerOnly: true,
        children: [
          {
            title: "Scorecard Settings",
            href: "/admin/eos/scorecards",
            icon: "BarChart3",
          },
        ],
      },
      {
        title: "Accountability",
        href: "/admin/eos/accountability",
        icon: "Shield",
        headerOnly: true,
        children: [
          {
            title: "Chart Management",
            href: "/admin/eos/accountability",
            icon: "Network",
          },
          {
            title: "V/TO Settings",
            href: "/admin/eos/vto",
            icon: "FileText",
          },
        ],
      },
    ],
  },
  {
    id: "project-settings",
    title: "PROJECT SETTINGS",
    icon: "FolderKanban",
    items: [
      {
        title: "Project Statuses",
        href: "/admin/settings/project-statuses",
        icon: "ListChecks",
      },
      {
        title: "Project Modules",
        href: "/admin/settings/project-modules",
        icon: "Layers",
      },
      {
        title: "Task Streams",
        href: "/admin/tasks/streams",
        icon: "GitBranch",
      },
    ],
  },
  {
    id: "intelligence-ai",
    title: "INTELLIGENCE & AI",
    icon: "Brain",
    isAI: true,
    items: [
      { title: "AI Analytics", href: "/admin/ai/analytics", icon: "BarChart3" },
      {
        title: "AI Agents",
        href: "/admin/ai/agents",
        icon: "Bot",
        headerOnly: true,
        children: [
          { title: "All Agents", href: "/admin/ai/agents", icon: "Bot" },
          { title: "Deal Coaching", href: "/admin/ai/deal-coaching", icon: "Target" },
          { title: "Email Drafting", href: "/admin/ai/email-drafting", icon: "MessageSquare" },
        ],
      },
      {
        title: "AI Configuration",
        href: "/admin/ai/agent-categories",
        icon: "Settings",
        headerOnly: true,
        children: [
          { title: "Agent Categories", href: "/admin/ai/agent-categories", icon: "FolderOpen" },
          { title: "Prompt Templates", href: "/admin/ai/prompt-templates", icon: "FileText" },
          { title: "Memory", href: "/admin/ai-hub/memory", icon: "Database" },
          { title: "AI Models", href: "/admin/ai-models", icon: "Cpu" },
        ],
      },
    ],
  },
  {
    id: "knowledge-base",
    title: "KNOWLEDGE BASE",
    icon: "BookOpen",
    items: [
      {
        title: "Knowledge Base",
        href: "/admin/knowledge/dashboard",
        icon: "BookOpen",
        headerOnly: true,
        children: [
          { title: "Dashboard", href: "/admin/knowledge/dashboard", icon: "LayoutDashboard" },
          { title: "Content", href: "/admin/knowledge/content", icon: "FolderOpen" },
          { title: "Access & Testing", href: "/admin/knowledge/access", icon: "Shield" },
        ],
      },
    ],
  },
  {
    id: "users-access",
    title: "USERS & ACCESS",
    icon: "Users",
    items: [
      {
        title: "User Management",
        href: "/admin/users",
        icon: "Users",
      },
      {
        title: "Role Management",
        href: "/admin/roles",
        icon: "Shield",
      },
      {
        title: "Departments",
        href: "/admin/departments",
        icon: "Building2",
      },
      {
        title: "Activity Logs",
        href: "/admin/logs",
        icon: "Activity",
      },
      {
        title: "Security",
        href: "/admin/security/authentication",
        icon: "Shield",
        children: [
          {
            title: "Authentication",
            href: "/admin/security/authentication",
            icon: "Shield",
          },
          {
            title: "SSO Settings",
            href: "/admin/security/sso",
            icon: "Shield",
          },
        ],
      },
    ],
  },
  {
    id: "general",
    title: "GENERAL",
    icon: "LayoutGrid",
    items: [
      {
        title: "Feedback",
        href: "/admin/feedback",
        icon: "MessageSquare",
      },
      {
        title: "Meeting Analytics",
        href: "/admin/meeting-analytics",
        icon: "Calendar",
      },
    ],
  },
  {
    id: "system",
    title: "SYSTEM",
    icon: "Settings",
    items: [
      {
        title: "Settings",
        href: "/admin/settings/branding",
        icon: "Settings",
        headerOnly: true,
        children: [
          {
            title: "Branding",
            href: "/admin/settings/branding",
            icon: "Palette",
          },
          {
            title: "Workspace",
            href: "/admin/settings/workspace",
            icon: "Layers",
          },
          {
            title: "Notifications",
            href: "/admin/notifications",
            icon: "Mail",
          },
          {
            title: "Template Seeding",
            href: "/admin/settings/seeding",
            icon: "Database",
          },
          {
            title: "Advanced",
            href: "/admin/settings/advanced",
            icon: "Zap",
          },
        ],
      },
      {
        title: "Integrations",
        href: "/admin/integrations",
        icon: "Zap",
      },
      {
        title: "MCP Servers",
        href: "/admin/mcp-servers",
        icon: "Plug",
      },
    ],
  },
];
