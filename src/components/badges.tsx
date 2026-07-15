import type { Priority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusMap: Record<TaskStatus, { label: string; cls: string }> = {
  yet_to_start: { label: "Yet to Start", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", cls: "bg-info/15 text-info" },
  on_hold: { label: "On Hold", cls: "bg-warning/15 text-warning" },
  submitted_for_review: { label: "Submitted for Review", cls: "bg-primary/15 text-primary" },
  closed: { label: "Closed", cls: "bg-success/15 text-success" },
};

const priorityMap: Record<Priority, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-destructive/15 text-destructive" },
  medium: { label: "Medium", cls: "bg-warning/15 text-warning" },
  low: { label: "Low", cls: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = statusMap[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const p = priorityMap[priority];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", p.cls)}>
      {p.label}
    </span>
  );
}
