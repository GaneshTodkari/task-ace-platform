import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  myAssignments,
  teamAssignments,
  listUsers,
  pendingReviewsFor,
  pendingExtensionsFor,
  runDueChecks,
} from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Users, BookMarked, Network, FolderKanban, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDescendants } from "@/lib/hierarchy";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  useDBVersion();
  useEffect(() => { runDueChecks(); }, []);
  if (!user) return null;
  if (user.role !== "admin") return <Navigate to="/tasks" />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const users = listUsers();
  const active = users.filter((u) => u.isActive).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-muted-foreground">Manage departments, projects, users and the predefined task library.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Active users" value={active} />
        <StatCard icon={Network} label="Total users" value={users.length} />
        <StatCard icon={BookMarked} label="Predefined tasks" value={undefined} hint="See library" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminLink to="/admin/departments" title="Departments" desc="Create, edit, deactivate." icon={Building2} />
        <AdminLink to="/admin/projects" title="Projects" desc="Manage projects by department." icon={FolderKanban} />
        <AdminLink to="/admin/users" title="Users" desc="Create, edit, deactivate." icon={Users} />
        <AdminLink to="/admin/hierarchy" title="Hierarchy" desc="Define reporting tree." icon={Network} />
        <AdminLink to="/admin/predefined" title="Predefined tasks" desc="Library by project." icon={BookMarked} />
      </div>
    </div>
  );
}

function AdminLink({ to, title, desc, icon: Icon }: any) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition group">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-medium group-hover:text-primary">{title}</div>
          <div className="text-sm text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{value ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FilterKey =
  | "yet_to_start"
  | "active"
  | "on_hold"
  | "overdue"
  | "due_today"
  | "due_tomorrow"
  | "due_72h"
  | "pending_reviews"
  | "pending_extensions"
  | "closed";

function SummaryCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: "default" | "orange" | "red" | "blue";
  active: boolean;
  onClick: () => void;
}) {
  const colorCls = {
    default: "bg-card hover:border-primary/60",
    orange: "bg-warning/5 border-warning/50 text-warning hover:bg-warning/10",
    red: "bg-destructive/5 border-destructive/50 text-destructive hover:bg-destructive/10",
    blue: "bg-info/5 border-info/50 text-info hover:bg-info/10",
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition hover:shadow-sm",
        colorCls,
        active && "ring-2 ring-primary",
      )}
    >
      <div className="text-2xl font-semibold">{count}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </button>
  );
}

function TaskDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey | null>(null);
  if (!user) return null;
  const mine = myAssignments(user);
  const team = (user.role === "manager" || user.role === "team_lead") ? teamAssignments(user) : [];
  const reviews = (user.role === "manager" || user.role === "team_lead") ? pendingReviewsFor(user) : [];
  const extensions = (user.role === "manager" || user.role === "team_lead") ? pendingExtensionsFor(user) : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAway = (d: string) => differenceInCalendarDays(new Date(d + "T00:00:00"), today);

  const counts = useMemo(() => {
    const c = {
      yet_to_start: 0, active: 0, on_hold: 0, overdue: 0,
      due_today: 0, due_tomorrow: 0, due_72h: 0,
      pending_reviews: 0, pending_extensions: 0, closed: 0,
    };
    for (const { task, assignment } of mine) {
      if (assignment.status === "closed") { c.closed++; continue; }
      if (assignment.status === "yet_to_start") c.yet_to_start++;
      if (assignment.status === "in_progress") c.active++;
      if (assignment.status === "on_hold") c.on_hold++;
      if (assignment.status === "submitted_for_review") c.pending_reviews++;
      if (assignment.extensionRequests.some((e) => e.status === "pending")) c.pending_extensions++;
      const d = daysAway(task.deadline);
      if (d < 0) c.overdue++;
      if (d === 0) c.due_today++;
      if (d === 1) c.due_tomorrow++;
      if (d >= 0 && d <= 3) c.due_72h++;
    }
    return c;
  }, [mine]);

  const filteredMine = useMemo(() => {
    if (!filter) return mine;
    return mine.filter(({ task, assignment }) => {
      const d = daysAway(task.deadline);
      switch (filter) {
        case "yet_to_start": return assignment.status === "yet_to_start";
        case "active": return assignment.status === "in_progress";
        case "on_hold": return assignment.status === "on_hold";
        case "overdue": return assignment.status !== "closed" && d < 0;
        case "due_today": return assignment.status !== "closed" && d === 0;
        case "due_tomorrow": return assignment.status !== "closed" && d === 1;
        case "due_72h": return assignment.status !== "closed" && d >= 0 && d <= 3;
        case "pending_reviews": return assignment.status === "submitted_for_review";
        case "pending_extensions": return assignment.extensionRequests.some((e) => e.status === "pending");
        case "closed": return assignment.status === "closed";
        default: return true;
      }
    });
  }, [mine, filter]);

  const users = listUsers();
  const descendants = getDescendants(users, user.id);
  const workload = descendants.map((u) => {
    const ts = team.filter((x) => x.assignment.assigneeId === u.id);
    return {
      name: u.fullName.split(" ")[0],
      "Yet to Start": ts.filter((x) => x.assignment.status === "yet_to_start").length,
      "In progress": ts.filter((x) => x.assignment.status === "in_progress").length,
      "On hold": ts.filter((x) => x.assignment.status === "on_hold").length,
      "In review": ts.filter((x) => x.assignment.status === "submitted_for_review").length,
      Closed: ts.filter((x) => x.assignment.status === "closed").length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.fullName.split(" ")[0]}</h1>
          <p className="text-muted-foreground capitalize">{user.role.replace("_", " ")} · {user.department}</p>
        </div>
        <Button asChild>
          <Link to="/tasks/new">Create task</Link>
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        <SummaryCard label="Yet to Start" count={counts.yet_to_start} color="default" active={filter === "yet_to_start"} onClick={() => setFilter(filter === "yet_to_start" ? null : "yet_to_start")} />
        <SummaryCard label="Active Tasks" count={counts.active} color="default" active={filter === "active"} onClick={() => setFilter(filter === "active" ? null : "active")} />
        <SummaryCard label="On Hold" count={counts.on_hold} color="orange" active={filter === "on_hold"} onClick={() => setFilter(filter === "on_hold" ? null : "on_hold")} />
        <SummaryCard label="Overdue" count={counts.overdue} color="red" active={filter === "overdue"} onClick={() => setFilter(filter === "overdue" ? null : "overdue")} />
        <SummaryCard label="Due Today" count={counts.due_today} color="default" active={filter === "due_today"} onClick={() => setFilter(filter === "due_today" ? null : "due_today")} />
        <SummaryCard label="Due Tomorrow" count={counts.due_tomorrow} color="default" active={filter === "due_tomorrow"} onClick={() => setFilter(filter === "due_tomorrow" ? null : "due_tomorrow")} />
        <SummaryCard label="Due in 72 Hours" count={counts.due_72h} color="blue" active={filter === "due_72h"} onClick={() => setFilter(filter === "due_72h" ? null : "due_72h")} />
        <SummaryCard label="Pending Reviews" count={counts.pending_reviews} color="blue" active={filter === "pending_reviews"} onClick={() => setFilter(filter === "pending_reviews" ? null : "pending_reviews")} />
        <SummaryCard label="Pending Extension Requests" count={counts.pending_extensions} color="default" active={filter === "pending_extensions"} onClick={() => setFilter(filter === "pending_extensions" ? null : "pending_extensions")} />
        <SummaryCard label="Closed" count={counts.closed} color="default" active={filter === "closed"} onClick={() => setFilter(filter === "closed" ? null : "closed")} />
      </div>

      {(user.role === "manager" || user.role === "team_lead") && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pending Reviews</CardTitle>
              <CardDescription>Assignments submitted for your review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
              {reviews.map(({ task, assignment }) => (
                <Link key={assignment.id} to="/tasks/$id" params={{ id: task.id }} className="block rounded-md border p-3 hover:bg-accent">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">{task.title}</div>
                    <StatusBadge status={assignment.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Assignee: {users.find((u) => u.id === assignment.assigneeId)?.fullName}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Extension Requests</CardTitle>
              <CardDescription>Requests awaiting your decision.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {extensions.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
              {extensions.map(({ task, assignment, extensionId }) => {
                const er = assignment.extensionRequests.find((x) => x.id === extensionId);
                return (
                  <Link key={extensionId} to="/tasks/$id" params={{ id: task.id }} className="block rounded-md border p-3 hover:bg-accent">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {users.find((u) => u.id === assignment.assigneeId)?.fullName} · new date {er?.proposedDeadline}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My tasks</CardTitle>
          <CardDescription>Assignments where you are the assignee.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredMine.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned.</p>}
          {filteredMine.map(({ task, assignment }) => {
            const isOverdue = assignment.status !== "closed" && new Date(task.deadline) < today;
            return (
              <Link
                key={assignment.id}
                to="/tasks/$id"
                params={{ id: task.id }}
                className={`block rounded-md border p-3 hover:bg-accent transition ${isOverdue ? "border-destructive/50 bg-destructive/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium">{task.title}</div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={assignment.status} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Due {format(new Date(task.deadline), "PP")}
                  {isOverdue && <span className="text-destructive ml-2 font-medium">Overdue</span>}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {(user.role === "manager" || user.role === "team_lead") && workload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
            <CardDescription>Assignments across your direct & indirect reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="Yet to Start" stackId="a" fill="var(--muted-foreground)" />
                  <Bar dataKey="In progress" stackId="a" fill="var(--info)" />
                  <Bar dataKey="On hold" stackId="a" fill="var(--warning)" />
                  <Bar dataKey="In review" stackId="a" fill="var(--primary)" />
                  <Bar dataKey="Closed" stackId="a" fill="var(--success)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
