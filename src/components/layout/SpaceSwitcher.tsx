import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSpaceOptional } from "@/contexts/SpaceContext";
import {
  Briefcase,
  BookOpen,
  Settings2,
  Target,
  type LucideIcon,
} from "lucide-react";

const SPACE_ICONS: Record<string, LucideIcon> = {
  Briefcase,
  BookOpen,
  Settings2,
  Target,
};

export function SpaceSwitcher() {
  const spaceCtx = useSpaceOptional();
  if (!spaceCtx) return null;

  const { visibleSpaces, currentSpace, setCurrentSpace } = spaceCtx;

  if (visibleSpaces.length <= 1) return null;

  return (
    <nav
      className="hidden md:flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
      aria-label="Workspace spaces"
    >
      {visibleSpaces.map((space) => {
        const Icon = SPACE_ICONS[space.icon] ?? Briefcase;
        const active = currentSpace === space.id;
        return (
          <button
            key={space.id}
            type="button"
            onClick={() => setCurrentSpace(space.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {space.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Mobile: compact space links in user area */
export function SpaceSwitcherLinks() {
  const spaceCtx = useSpaceOptional();
  if (!spaceCtx) return null;

  const { visibleSpaces, currentSpace } = spaceCtx;

  return (
    <>
      {visibleSpaces.map((space) => (
        <Link
          key={space.id}
          to={space.dashboardPath}
          className={cn(
            "text-sm",
            currentSpace === space.id ? "font-medium text-primary" : "text-muted-foreground"
          )}
        >
          {space.label} Space
        </Link>
      ))}
    </>
  );
}
