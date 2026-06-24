import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { tasksFor } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, isBefore } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TaskList,
});

function TaskList() {
  const { user } = useAuth();
  useDBVersion();
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [q, setQ] = useState("");

  const tasks = useMemo(() => (user ? tasksFor(user) : []), [user]);
  const filtered = tasks.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (priority !== "all" && t.priority !== priority) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Everything visible to you within your hierarchy.</p>
        </div>
        {(user.role === "manager" || user.role === "team_lead") && (
          <Button asChild><Link to="/tasks/new">Create task</Link></Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks match the current filters.</p>
        )}
        {filtered.map((t) => {
          const now = new Date();
          const overdue = t.status !== "completed" && isBefore(new Date(t.deadline), now);
          return (
            <Link
              key={t.id}
              to="/tasks/$id"
              params={{ id: t.id }}
              className={`block rounded-md border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition ${
                overdue ? "border-destructive/40" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.category} · Due {format(new Date(t.deadline), "PPp")}
                    {overdue && <span className="text-destructive ml-2 font-medium">Overdue</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
