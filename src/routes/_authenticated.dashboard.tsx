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
import { AlertTriangle, Clock, ListTodo, CheckCircle2, Users, BookMarked, Network, FolderKanban, Building2 } from "lucide-react";
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

function TaskDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  const mine = myAssignments(user);
  const team = (user.role === "manager" || user.role === "team_lead") ? teamAssignments(user) : [];
  const reviews = (user.role === "manager" || user.role === "team_lead") ? pendingReviewsFor(user) : [];
  const extensions = (user.role === "manager" || user.role === "team_lead") ? pendingExtensionsFor(user) : [];

  const today = new Date();
  const open = mine.filter((x) => x.assignment.status !== "closed");
  const overdue = open.filter((x) => new Date(x.task.deadline) < today);
  const dueSoon = open.filter((x) => {
    const d = differenceInCalendarDays(new Date(x.task.deadline), today);
    return d >= 0 && d <= 1;
  });
  const closed = mine.filter((x) => x.assignment.status === "closed").length;

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="My tasks" value={mine.length} />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdue.length} />
        <StatCard icon={Clock} label="Due today/tomorrow" value={dueSoon.length} />
        <StatCard icon={CheckCircle2} label="Closed" value={closed} />
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
          {mine.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned.</p>}
          {mine.map(({ task, assignment }) => {
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
