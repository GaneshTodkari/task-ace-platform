import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { myTasks, teamTasks, listUsers, tasksFor } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { format, isBefore, addHours } from "date-fns";
import { AlertTriangle, Clock, ListTodo, CheckCircle2, Users, BookMarked, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDescendants } from "@/lib/hierarchy";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  useDBVersion();
  if (!user) return null;
  if (user.role === "admin") return <AdminDashboard />;
  return <TaskDashboard />;
}

function AdminDashboard() {
  const users = listUsers();
  const active = users.filter((u) => u.isActive).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-muted-foreground">Manage users, hierarchy and the predefined task library.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Active users" value={active} />
        <StatCard icon={Network} label="Total users" value={users.length} />
        <StatCard icon={BookMarked} label="Predefined tasks" value={undefined} hint="See library" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminLink to="/admin/users" title="Users" desc="Create, edit, deactivate." icon={Users} />
        <AdminLink to="/admin/hierarchy" title="Hierarchy" desc="Define reporting tree." icon={Network} />
        <AdminLink to="/admin/predefined" title="Predefined tasks" desc="Library by department." icon={BookMarked} />
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
  const mine = myTasks(user);
  const visible = tasksFor(user);
  const team = (user.role === "manager" || user.role === "team_lead") ? teamTasks(user) : [];

  const now = new Date();
  const soon = addHours(now, 24);
  const overdue = mine.filter((t) => t.status !== "completed" && isBefore(new Date(t.deadline), now));
  const dueSoon = mine.filter(
    (t) => t.status !== "completed" && !isBefore(new Date(t.deadline), now) && isBefore(new Date(t.deadline), soon),
  );
  const completed = mine.filter((t) => t.status === "completed").length;

  const descendants = getDescendants(listUsers(), user.id);
  const workload = descendants.map((u) => {
    const ts = visible.filter((t) => t.assigneeIds.includes(u.id));
    return {
      name: u.fullName.split(" ")[0],
      "Not started": ts.filter((t) => t.status === "not_started").length,
      "In progress": ts.filter((t) => t.status === "in_progress").length,
      "On hold": ts.filter((t) => t.status === "on_hold").length,
      Completed: ts.filter((t) => t.status === "completed").length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.fullName.split(" ")[0]}</h1>
          <p className="text-muted-foreground capitalize">{user.role.replace("_", " ")} · {user.department}</p>
        </div>
        {(user.role === "manager" || user.role === "team_lead") && (
          <Button asChild>
            <Link to="/tasks/new">Create task</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="My tasks" value={mine.length} />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdue.length} />
        <StatCard icon={Clock} label="Due in 24h" value={dueSoon.length} />
        <StatCard icon={CheckCircle2} label="Completed" value={completed} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My tasks</CardTitle>
          <CardDescription>Tasks assigned to you. Overdue items are highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {mine.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned.</p>}
          {mine.map((t) => {
            const isOverdue = t.status !== "completed" && isBefore(new Date(t.deadline), now);
            const isSoon = t.status !== "completed" && !isOverdue && isBefore(new Date(t.deadline), soon);
            return (
              <Link
                key={t.id}
                to="/tasks/$id"
                params={{ id: t.id }}
                className={`block rounded-md border p-3 hover:bg-accent transition ${
                  isOverdue ? "border-destructive/50 bg-destructive/5" : isSoon ? "border-warning/50 bg-warning/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium">{t.title}</div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Due {format(new Date(t.deadline), "PPp")}
                  {isOverdue && <span className="text-destructive ml-2 font-medium">Overdue</span>}
                  {isSoon && <span className="text-warning ml-2 font-medium">Due soon</span>}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {(user.role === "manager" || user.role === "team_lead") && team.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
            <CardDescription>Tasks across your direct & indirect reports.</CardDescription>
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
                  <Bar dataKey="Not started" stackId="a" fill="var(--muted-foreground)" />
                  <Bar dataKey="In progress" stackId="a" fill="var(--info)" />
                  <Bar dataKey="On hold" stackId="a" fill="var(--warning)" />
                  <Bar dataKey="Completed" stackId="a" fill="var(--success)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
