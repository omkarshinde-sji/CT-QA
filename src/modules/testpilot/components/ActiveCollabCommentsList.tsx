import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveCollabTaskComment } from "../types/activecollab.types";

function formatCommentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ActiveCollabCommentsListProps {
  comments: ActiveCollabTaskComment[];
  className?: string;
  maxHeight?: string;
}

export function ActiveCollabCommentsList({
  comments,
  className,
  maxHeight = "max-h-64",
}: ActiveCollabCommentsListProps) {
  if (!comments.length) {
    return (
      <p className="text-xs text-muted-foreground">No comments on this task yet.</p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Task comments ({comments.length})
      </div>
      <ul
        className={cn(
          "space-y-2 overflow-y-auto rounded-md border bg-background/80 p-2",
          maxHeight,
        )}
      >
        {comments.map((comment, index) => (
          <li
            key={`${comment.author}-${comment.createdAt}-${index}`}
            className="rounded-md border bg-card p-3 text-sm shadow-sm"
          >
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">{comment.author}</span>
              <time
                className="text-[11px] text-muted-foreground"
                dateTime={comment.createdAt}
              >
                {formatCommentDate(comment.createdAt)}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {comment.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
