import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { tasksFor, listUsers, projectById } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TaskList,
});

function TaskList() {
  const { user } = useAuth();
  useDBVersion();
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [q, setQ] = useState("");
  const [employee, setEmployee] = useState<string>("all");

  const users = listUsers();
  const tasks = useMemo(() => (user ? tasksFor(user) : []), [user]);
  const rows = useMemo(() => {
    const out: { taskId: string; title: string; projectName: string; priority: any; deadline: string; assigneeId: string; assigneeName: string; status: any }[] = [];
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
        });
      }
    }
    return out;
  }, [tasks, users]);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (priority !== "all" && r.priority !== priority) return false;
    if (employee !== "all" && r.assigneeId !== employee) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!user) return null;

  const employeeOptions = Array.from(new Set(rows.map((r) => r.assigneeId))).map((id) => ({ id, name: users.find((u) => u.id === id)?.fullName ?? id }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Assignments visible to you within your hierarchy.</p>
        </div>
        <Button asChild><Link to="/tasks/new">Create task</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="submitted_for_review">Submitted for review</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
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
          <Select value={employee} onValueChange={setEmployee}>
            <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employeeOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
