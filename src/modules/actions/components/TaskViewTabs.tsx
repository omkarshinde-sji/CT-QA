import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  AlertTriangle,
  Users,
  ListTodo,
  LayoutGrid,
  Ticket,
} from "lucide-react";
import type { TaskView, TaskStats } from "../types/tasks";

interface TaskViewTabsProps {
  currentView: TaskView | "streams";
  onViewChange: (view: TaskView | "streams") => void;
  stats?: TaskStats;
}

const views: {
  value: TaskView | "streams";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  statsKey?: keyof TaskStats;
  isLink?: boolean;
}[] = [
  { value: "today", label: "Today", icon: Calendar, statsKey: "todayCount" },
  { value: "this_week", label: "This Week", icon: Calendar, statsKey: "thisWeekCount" },
  { value: "overdue", label: "Overdue", icon: AlertTriangle, statsKey: "overdue" },
  { value: "delegated", label: "Delegated", icon: Users, statsKey: "delegatedCount" },
  { value: "allMine", label: "All Tasks", icon: ListTodo, statsKey: "allMineCount" },
  { value: "jira", label: "Jira", icon: Ticket },
  { value: "streams", label: "Streams", icon: LayoutGrid, isLink: true },
];

export function TaskViewTabs({ currentView, onViewChange, stats }: TaskViewTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b">
      {views.map((view) => {
        const isActive = currentView === view.value;
        const count = view.statsKey && stats ? stats[view.statsKey] : undefined;
        const isOverdueWithItems = view.value === "overdue" && count && count > 0;
        const Icon = view.icon;

        if (view.isLink) {
          return (
            <Link
              key={view.value}
              to="/streams"
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {view.label}
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent" />
            </Link>
          );
        }

        return (
          <button
            key={view.value}
            onClick={() => onViewChange(view.value)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {view.label}
            {count !== undefined && count > 0 && (
              <Badge
                variant={isOverdueWithItems ? "destructive" : "secondary"}
                className="h-5 min-w-[20px] px-1.5 text-[10px]"
              >
                {count}
              </Badge>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
