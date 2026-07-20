import { createFileRoute, Link } from "@tanstack/react-router";
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
  projectById,
} from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { format, differenceInCalendarDays } from "date-fns";
import {
  AlertTriangle,
  ListTodo,
  Users,
  BookMarked,
  Network,
  FolderKanban,
  Building2,
  Clock3,
  PlayCircle,
  PauseCircle,
  ClipboardCheck,
  CheckCircle2,
  TriangleAlert,
  CalendarClock,
  CalendarDays,
  Timer,
  FileClock,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDescendants } from "@/lib/hierarchy";
import { cn } from "@/lib/utils";
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
  if (user.role === "admin") return <AdminDashboard />;
  return <TaskDashboard />;
}

function AdminDashboard() {
  const users = listUsers();
  const active = users.filter((u) => u.isActive).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-muted-foreground">Manage departments, projects, users and the predefined task library.</p>
      </div>
      <div className="grid gap-1 sm:grid-cols-3">
        <StatCard icon={Users} label="Active users" value={active} />
        <StatCard icon={Network} label="Total users" value={users.length} />
        <AdminLink to="/admin/departments" title="Departments" desc="Create, edit, deactivate." icon={Building2} />
        <AdminLink to="/admin/projects" title="Projects" desc="Manage projects by department." icon={FolderKanban} />
        <AdminLink to="/admin/users" title="Users" desc="Create, edit, deactivate." icon={Users} />
        <AdminLink to="/admin/hierarchy" title="Hierarchy" desc="Define reporting tree." icon={Network} />
        <AdminLink to="/admin/predefined" title="Predefined tasks" desc="Library by project." icon={BookMarked } />
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

const cardStyles: Record<
  Filter,
  {
    icon: LucideIcon;
    border: string;
    iconBg: string;
    iconColor: string;
    footer: string;
  }
> = {
  yet_to_start: {
    icon: Clock3,
    border: "border-t-4 border-t-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    footer: "Waiting",
  },

  in_progress: {
    icon: PlayCircle,
    border: "border-t-4 border-t-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    footer: "Healthy",
  },

  on_hold: {
    icon: PauseCircle,
    border: "border-t-4 border-t-yellow-500",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    footer: "Paused",
  },

  submitted_for_review: {
    icon: ClipboardCheck,
    border: "border-t-4 border-t-violet-500",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    footer: "Awaiting Review",
  },

  pending_reviews: {
    icon: ClipboardCheck,
    border: "border-t-4 border-t-violet-500",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    footer: "Needs Approval",
  },

  closed: {
    icon: CheckCircle2,
    border: "border-t-4 border-t-emerald-500",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    footer: "Completed",
  },

  overdue: {
    icon: TriangleAlert,
    border: "border-t-4 border-t-red-500",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    footer: "Needs Attention",
  },

  due_today: {
    icon: CalendarClock,
    border: "border-t-4 border-t-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    footer: "Today",
  },

  due_tomorrow: {
    icon: CalendarDays,
    border: "border-t-4 border-t-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    footer: "Tomorrow",
  },

  due_72h: {
    icon: Timer,
    border: "border-t-4 border-t-sky-500",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    footer: "Upcoming",
  },

  pending_extensions: {
    icon: FileClock,
    border: "border-t-4 border-t-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    footer: "Pending",
  },

  all: {
    icon: Clock3,
    border: "",
    iconBg: "",
    iconColor: "",
    footer: "",
  },
};

function TaskDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  if (!user) return null;
  const isMgrOrTL = user.role === "manager" || user.role === "team_lead";
  const mine = myAssignments(user);
  const team = isMgrOrTL ? teamAssignments(user) : [];
  const reviews = isMgrOrTL ? pendingReviewsFor(user) : [];
  const extensions = isMgrOrTL ? pendingExtensionsFor(user) : [];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysAway = (d: string) => differenceInCalendarDays(new Date(d + "T00:00:00"), today);

  // Employees see their own assignments; Mgr/TL see team + own
  const scope = isMgrOrTL ? [...team, ...mine] : mine;
  // Dedup by assignment id
  const seen = new Set<string>();
  const rows = scope.filter((x) => {
    if (seen.has(x.assignment.id)) return false;
    seen.add(x.assignment.id); return true;
  });

  const counts = useMemo(() => {
    const c = {
      yet_to_start: 0, in_progress: 0, on_hold: 0, overdue: 0,
      due_today: 0, due_tomorrow: 0, due_72h: 0,
      submitted_for_review: 0, closed: 0,
    };
    for (const { task, assignment } of rows) {
      if (assignment.status === "closed") { c.closed++; continue; }
      if (assignment.status === "yet_to_start") c.yet_to_start++;
      if (assignment.status === "in_progress") c.in_progress++;
      if (assignment.status === "on_hold") c.on_hold++;
      if (assignment.status === "submitted_for_review") c.submitted_for_review++;
      const d = daysAway(task.deadline);
      if (d < 0) c.overdue++;
      if (d === 0) c.due_today++;
      if (d === 1) c.due_tomorrow++;
      if (d >= 0 && d <= 3) c.due_72h++;
    }
    return c;
  }, [rows]);

  type DashboardCard = {
  id: Filter;
  label: string;
  value: number;
}; 
const cards: DashboardCard[] = [
  {
    id: "yet_to_start",
    label: "Yet to Start",
    value: counts.yet_to_start,
  },

  {
    id: "in_progress",
    label: "Active Tasks",
    value: counts.in_progress,
  },

  {
    id: "on_hold",
    label: "On Hold",
    value: counts.on_hold,
  },

  ...(isMgrOrTL
    ? [{
        id: "pending_reviews" as Filter,
        label: "Pending Reviews",
        value: reviews.length,
      }]
    : [{
        id: "submitted_for_review" as Filter,
        label: "Submitted for Review",
        value: counts.submitted_for_review,
      }]),

    ...(isMgrOrTL
    ? [{
        id: "pending_extensions" as Filter,
        label: "Pending Extensions",
        value: extensions.length,
      }]
    : []),

  {
    id: "overdue",
    label: "Overdue",
    value: counts.overdue,
  },

  {
    id: "due_today",
    label: "Due Today",
    value: counts.due_today,
  },

  {
    id: "due_tomorrow",
    label: "Due Tomorrow",
    value: counts.due_tomorrow,
  },

  {
    id: "due_72h",
    label: "Due in 72 Hours",
    value: counts.due_72h,
  },

  {
    id: "closed",
    label: "Closed",
    value: counts.closed,
  },
];

  const users = listUsers();
  const filtered = rows.filter(({ task, assignment }) => {
    switch (filter) {
      case "yet_to_start": return assignment.status === "yet_to_start";
      case "in_progress": return assignment.status === "in_progress";
      case "on_hold": return assignment.status === "on_hold";
      case "submitted_for_review": return assignment.status === "submitted_for_review";
      case "closed": return assignment.status === "closed";
      case "overdue": return assignment.status !== "closed" && daysAway(task.deadline) < 0;
      case "due_today": return assignment.status !== "closed" && daysAway(task.deadline) === 0;
      case "due_tomorrow": return assignment.status !== "closed" && daysAway(task.deadline) === 1;
      case "due_72h": {
        const d = daysAway(task.deadline);
        return assignment.status !== "closed" && d >= 0 && d <= 3;
      }
      case "pending_reviews":
        return reviews.some((x) => x.assignment.id === assignment.id);
      case "pending_extensions":
        return extensions.some((x) => x.assignment.id === assignment.id);
      case "all":
      default: return true;
    }
  });

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
      </div>

      <div className="grid grid-cols-5 gap-3 w-fit">
        {cards.map((c) => {
          const style = cardStyles[c.id];
          const Icon = style.icon;

          return (
            <button
              key={c.id}
              onClick={() => setFilter((cur) => (cur === c.id ? "all" : c.id))}
              className={cn(
                "w-[150px] h-[85px] rounded-xl border bg-card px-1 py-2 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                style.border,
                filter === c.id && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    style.iconBg
                  )}
                >
                  <Icon className={cn("h-4 w-4", style.iconColor)} />
                </div>

                <div className="flex-1">
                  <div className="text-[12px] font-semibold leading-tight">
                    {c.label}
                  </div>

                  <div className="mt-1 text-l font-bold items-center leading-none">
                    {c.value}
                  </div>

                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {style.footer}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>{filter === "all" ? "Tasks" : cards.find((c) => c.id === filter)?.label}</CardTitle>
              <CardDescription>
                {filter === "all"
                  ? (isMgrOrTL ? "All assignments in your hierarchy." : "Your assignments.")
                  : `Filtered by ${cards.find((c) => c.id === filter)?.label}.`}
              </CardDescription>
            </div>
            {filter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Clear filter</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "No tasks yet." : "Nothing matches this filter."}
            </p>
          )}
          {filtered.map(({ task, assignment }) => {
            const isOverdue = assignment.status !== "closed" && daysAway(task.deadline) < 0;
            const assignee = users.find((u) => u.id === assignment.assigneeId);
            return (
              <Link
                key={assignment.id}
                to="/tasks/$id"
                params={{ id: task.id }}
                className={`block rounded-md border p-2 hover:bg-accent transition ${isOverdue ? "border-destructive/50 bg-destructive/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{projectById(task.projectId)?.name ?? "—"}</span>
                      <span>· Due {format(new Date(task.deadline), "PP")}</span>
                      {isMgrOrTL && assignee && <span>· {assignee.fullName}</span>}
                      {isOverdue && <span className="text-destructive font-medium">Overdue</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={assignment.status} />
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {isMgrOrTL && workload.length > 0 && (
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

      {/* silence unused warning */}
      <span className="hidden"><AlertTriangle /><ListTodo /></span>
    </div>
  );
}
