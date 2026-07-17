import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { listTasks, listUsers, projectById } from "@/lib/api";
import { getDescendants } from "@/lib/hierarchy";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, differenceInCalendarDays } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import type { Task, TaskAssignment, TaskStatus, User } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/recurring")({
  component: RecurringPage,
});

type Entry = {
  task: Task;
  assignment: TaskAssignment;
  assignee: User | undefined;
  deadline: Date;
  isSelf: boolean;
};

const STATUS_STYLES: Record<TaskStatus, { dot: string; label: string; chip: string }> = {
  yet_to_start: { dot: "bg-gray-400", label: "Yet to Start", chip: "bg-gray-100 text-gray-800 border-gray-300" },
  in_progress: { dot: "bg-blue-500", label: "In Progress", chip: "bg-blue-100 text-blue-800 border-blue-300" },
  on_hold: { dot: "bg-orange-500", label: "On Hold", chip: "bg-orange-100 text-orange-800 border-orange-300" },
  submitted_for_review: { dot: "bg-purple-500", label: "Submitted for Review", chip: "bg-purple-100 text-purple-800 border-purple-300" },
  closed: { dot: "bg-green-600", label: "Closed", chip: "bg-green-100 text-green-800 border-green-300" },
};
const OVERDUE = { dot: "bg-red-600", label: "Overdue", chip: "bg-red-100 text-red-800 border-red-300" };

function entryStyle(e: Entry) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (e.assignment.status !== "closed" && e.deadline < today) return OVERDUE;
  return STATUS_STYLES[e.assignment.status];
}

function RecurringPage() {
  const { user } = useAuth();
  useDBVersion();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const users = listUsers();
  const entries = useMemo<Entry[]>(() => {
    if (!user) return [];
    const scopeIds = new Set<string>([user.id]);
    if (user.role === "manager" || user.role === "team_lead") {
      for (const d of getDescendants(users, user.id)) scopeIds.add(d.id);
    }
    const out: Entry[] = [];
    for (const t of listTasks()) {
      if (!t.isRecurring && !t.parentRecurrenceId) continue;
      for (const a of t.assignments) {
        if (!scopeIds.has(a.assigneeId)) continue;
        out.push({
          task: t,
          assignment: a,
          assignee: users.find((u) => u.id === a.assigneeId),
          deadline: new Date(t.deadline + "T00:00:00"),
          isSelf: a.assigneeId === user.id,
        });
      }
    }
    return out;
  }, [user, users]);

  if (!user) return null;

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = format(e.deadline, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  const isMgrOrTL = user.role === "manager" || user.role === "team_lead";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring Tasks</h1>
          <p className="text-muted-foreground">
            {isMgrOrTL ? "Your recurring tasks and those of your reportees." : "Your recurring task instances."}
          </p>
        </div>
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5", view === "calendar" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="size-4" /> Calendar
          </button>
          <button
            className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 border-l", view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
            onClick={() => setView("list")}
          >
            <List className="size-4" /> List
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{format(cursor, "MMMM yyyy")}</CardTitle>
              <CardDescription>Deadlines of your recurring task instances.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}>
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEntries = entriesByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={key}
                    className={cn(
                      "bg-card min-h-24 p-1.5 flex flex-col gap-1",
                      !inMonth && "bg-muted/30",
                    )}
                  >
                    <div className={cn(
                      "text-xs font-medium self-end px-1 rounded",
                      isToday && "bg-primary text-primary-foreground",
                      !inMonth && !isToday && "text-muted-foreground",
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {dayEntries.slice(0, 3).map((e) => {
                        const s = entryStyle(e);
                        return (
                          <Link
                            key={e.assignment.id}
                            to="/tasks/$id"
                            params={{ id: e.task.id }}
                            className={cn(
                              "text-[11px] leading-tight rounded border px-1.5 py-1 hover:opacity-80 transition truncate flex items-center gap-1",
                              s.chip,
                            )}
                            title={`${e.task.title} — ${s.label}`}
                          >
                            <span className={cn("inline-block size-1.5 rounded-full shrink-0", s.dot)} />
                            <span className="truncate">{e.task.title}</span>
                            {isMgrOrTL && !e.isSelf && e.assignee && (
                              <span className="hidden sm:inline text-[10px] opacity-75 truncate">· {e.assignee.fullName.split(" ")[0]}</span>
                            )}
                          </Link>
                        );
                      })}
                      {dayEntries.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEntries.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
              <span className="font-medium">Legend:</span>
              {(Object.keys(STATUS_STYLES) as TaskStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn("inline-block size-2.5 rounded-full", STATUS_STYLES[s].dot)} />
                  {STATUS_STYLES[s].label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block size-2.5 rounded-full", OVERDUE.dot)} />
                Overdue
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No recurring tasks in scope.</p>
          )}
          {entries
            .slice()
            .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
            .map((e) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const overdue = e.assignment.status !== "closed" && e.deadline < today;
              const daysLeft = differenceInCalendarDays(e.deadline, today);
              return (
                <Link
                  key={e.assignment.id}
                  to="/tasks/$id"
                  params={{ id: e.task.id }}
                  className={cn(
                    "block rounded-md border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition",
                    overdue && "border-destructive/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{e.task.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>{projectById(e.task.projectId)?.name ?? "—"}</span>
                        <span>· Due {format(e.deadline, "PP")}</span>
                        {e.assignee && <Badge variant="outline">{e.assignee.fullName}</Badge>}
                        {e.task.recurrencePattern && (
                          <Badge variant="secondary" className="capitalize">{e.task.recurrencePattern}</Badge>
                        )}
                        {overdue ? (
                          <span className="text-destructive font-medium">Overdue</span>
                        ) : (
                          <span>{daysLeft === 0 ? "Due today" : daysLeft > 0 ? `in ${daysLeft}d` : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={e.task.priority} />
                      <StatusBadge status={e.assignment.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
