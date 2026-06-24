import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listUsers, teamTasks } from "@/lib/api";
import { getDescendants } from "@/lib/hierarchy";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

function TeamPage() {
  const { user } = useAuth();
  useDBVersion();
  const [focus, setFocus] = useState<string>("all");

  if (!user) return null;
  if (user.role !== "manager" && user.role !== "team_lead") {
    return <p className="text-muted-foreground">Only managers and team leads can view this page.</p>;
  }

  const users = listUsers();
  const desc = getDescendants(users, user.id);
  const team = teamTasks(user);

  const workload = useMemo(
    () =>
      desc.map((u) => {
        const ts = team.filter((t) => t.assigneeIds.includes(u.id));
        return {
          name: u.fullName.split(" ")[0],
          "Not started": ts.filter((t) => t.status === "not_started").length,
          "In progress": ts.filter((t) => t.status === "in_progress").length,
          "On hold": ts.filter((t) => t.status === "on_hold").length,
          Completed: ts.filter((t) => t.status === "completed").length,
        };
      }),
    [desc, team],
  );

  const filtered = focus === "all" ? team : team.filter((t) => t.assigneeIds.includes(focus));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team overview</h1>
        <p className="text-muted-foreground">Tasks and workload across your reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workload</CardTitle>
          <CardDescription>Open and closed tasks per reportee.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Drill-down</CardTitle>
            <CardDescription>Filter by reportee.</CardDescription>
          </div>
          <Select value={focus} onValueChange={setFocus}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reports</SelectItem>
              {desc.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No tasks.</p>}
          {filtered.map((t) => (
            <Link
              key={t.id}
              to="/tasks/$id"
              params={{ id: t.id }}
              className="block rounded-md border p-3 hover:bg-accent transition"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Due {format(new Date(t.deadline), "PPp")} ·{" "}
                    {t.assigneeIds.map((id) => users.find((u) => u.id === id)?.fullName).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
