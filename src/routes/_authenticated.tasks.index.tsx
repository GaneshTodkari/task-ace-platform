import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { tasksFor, listUsers, projectById, pendingReviewsFor, pendingExtensionsFor, myAssignments, teamAssignments, runDueChecks } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getDescendants } from "@/lib/hierarchy";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Priority, TaskStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TaskList,
});

type Filter =
  | "all"
  | "yet_to_start"
  | "in_progress"
  | "on_hold"
  | "overdue"
  | "due_today"
  | "due_tomorrow"
  | "due_72h"
  | "submitted_for_review"
  | "closed"
  | "pending_reviews"
  | "pending_extensions";

function TaskList() {
  const { user } = useAuth();
  useDBVersion();
  const [filter, setFilter] = useState<Filter>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [q, setQ] = useState("");
  const [employee, setEmployee] = useState<string>("all");

  const users = listUsers();
  const tasks = useMemo(() => (user ? tasksFor(user) : []), [user]);
  const reviews = user && (user.role === "manager" || user.role === "team_lead") ? pendingReviewsFor(user) : [];
  const extensions = user && (user.role === "manager" || user.role === "team_lead") ? pendingExtensionsFor(user) : [];

  const rows = useMemo(() => {
    const out: {
      taskId: string; title: string; projectName: string;
      priority: Priority; deadline: string; assigneeId: string; assigneeName: string;
      status: TaskStatus; extensionPending: boolean;
    }[] = [];
    for (const t of tasks) {
      for (const a of t.assignments) {
        out.push({
          taskId: t.id,
          title: t.title,
          projectName: projectById(t.projectId)?.name ?? "—",
          priority: t.priority,
          deadline: t.deadline,
          assigneeId: a.assigneeId,
          assigneeName: users.find((u) => u.id === a.assigneeId)?.fullName ?? a.assigneeId,
          status: a.status,
          extensionPending: a.extensionRequests.some((e) => e.status === "pending"),
        });
      }
    }
    return out;
  }, [tasks, users]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysAway = (d: string) => differenceInCalendarDays(new Date(d + "T00:00:00"), today);

  const counts = useMemo(() => {
    const c = {
      yet_to_start: 0, in_progress: 0, on_hold: 0, overdue: 0,
      due_today: 0, due_tomorrow: 0, due_72h: 0,
      submitted_for_review: 0, closed: 0,
    };
    for (const r of rows) {
      if (r.status === "closed") { c.closed++; continue; }
      if (r.status === "yet_to_start") c.yet_to_start++;
      if (r.status === "in_progress") c.in_progress++;
      if (r.status === "on_hold") c.on_hold++;
      if (r.status === "submitted_for_review") c.submitted_for_review++;
      const d = daysAway(r.deadline);
      if (d < 0) c.overdue++;
      if (d === 0) c.due_today++;
      if (d === 1) c.due_tomorrow++;
      if (d >= 0 && d <= 3) c.due_72h++;
    }
    return c;
  }, [rows]);

  const isMgrOrTL = user?.role === "manager" || user?.role === "team_lead";

  const filtered = rows.filter((r) => {
    // Card filter
    switch (filter) {
      case "yet_to_start": if (r.status !== "yet_to_start") return false; break;
      case "in_progress": if (r.status !== "in_progress") return false; break;
      case "on_hold": if (r.status !== "on_hold") return false; break;
      case "submitted_for_review": if (r.status !== "submitted_for_review") return false; break;
      case "closed": if (r.status !== "closed") return false; break;
      case "overdue": if (!(r.status !== "closed" && daysAway(r.deadline) < 0)) return false; break;
      case "due_today": if (!(r.status !== "closed" && daysAway(r.deadline) === 0)) return false; break;
      case "due_tomorrow": if (!(r.status !== "closed" && daysAway(r.deadline) === 1)) return false; break;
      case "due_72h": {
        const d = daysAway(r.deadline);
        if (!(r.status !== "closed" && d >= 0 && d <= 3)) return false;
        break;
      }
      case "pending_reviews":
        if (!reviews.some((x) => x.task.id === r.taskId && x.assignment.assigneeId === r.assigneeId)) return false;
        break;
      case "pending_extensions":
        if (!extensions.some((x) => x.task.id === r.taskId && x.assignment.assigneeId === r.assigneeId)) return false;
        break;
      case "all":
      default: break;
    }
    if (priorityFilter.length > 0 && !priorityFilter.includes(r.priority)) return false;
    if (employee !== "all" && r.assigneeId !== employee) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!user) return null;

  const employeeOptions = Array.from(new Set(rows.map((r) => r.assigneeId))).map((id) => ({
    id, name: users.find((u) => u.id === id)?.fullName ?? id,
  }));

  const togglePriority = (p: Priority) => {
    setPriorityFilter((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };

  const cards: { id: Filter; label: string; value: number }[] = [
    { id: "yet_to_start", label: "Yet to Start", value: counts.yet_to_start },
    { id: "in_progress", label: "Active Tasks", value: counts.in_progress },
    { id: "on_hold", label: "On Hold", value: counts.on_hold },
    { id: "overdue", label: "Overdue", value: counts.overdue },
    { id: "due_today", label: "Due Today", value: counts.due_today },
    { id: "due_tomorrow", label: "Due Tomorrow", value: counts.due_tomorrow },
    { id: "due_72h", label: "Due in 72 Hours", value: counts.due_72h },
    ...(isMgrOrTL
      ? [
          { id: "pending_reviews" as Filter, label: "Pending Reviews", value: reviews.length },
          { id: "pending_extensions" as Filter, label: "Pending Extension Requests", value: extensions.length },
        ]
      : [{ id: "submitted_for_review" as Filter, label: "Submitted for Review", value: counts.submitted_for_review }]),
    { id: "closed", label: "Closed", value: counts.closed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Assignments visible to you within your hierarchy.</p>
        </div>
        <Button asChild><Link to="/tasks/new">Create task</Link></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter((cur) => cur === c.id ? "all" : c.id)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left hover:border-primary/60 hover:shadow-sm transition",
              filter === c.id && "border-primary ring-1 ring-primary/40",
            )}
          >
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={employee} onValueChange={setEmployee}>
            <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employeeOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Priority:</span>
            {(["high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs capitalize",
                  priorityFilter.includes(p) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                )}
              >{p}</button>
            ))}
            {priorityFilter.length > 0 && (
              <button className="text-xs text-muted-foreground hover:text-foreground ml-1" onClick={() => setPriorityFilter([])}>Clear</button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No assignments match the current filters.</p>
        )}
        {filtered.map((r, i) => {
          const overdue = r.status !== "closed" && new Date(r.deadline) < new Date();
          return (
            <Link
              key={`${r.taskId}_${r.assigneeId}_${i}`}
              to="/tasks/$id"
              params={{ id: r.taskId }}
              className={`block rounded-md border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition ${overdue ? "border-destructive/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>{r.projectName}</span>
                    <span>· Due {format(new Date(r.deadline), "PP")}</span>
                    <Badge variant="outline" className="ml-1">{r.assigneeName}</Badge>
                    {overdue && <span className="text-destructive font-medium">Overdue</span>}
                    {r.extensionPending && <Badge variant="secondary">Extension pending</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={r.priority} />
                  <StatusBadge status={r.status} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
