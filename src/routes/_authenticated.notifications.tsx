import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { listNotifications, markAllRead, markNotificationRead } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  useDBVersion();
  if (!user) return null;
  const items = listNotifications(user.id);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Activity on tasks that involve you.</p>
        </div>
        {items.some((n) => !n.read) && (
          <Button variant="outline" size="sm" onClick={() => markAllRead(user.id)}>Mark all read</Button>
        )}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4" /> Inbox</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
          {items.map((n) => (
            <Link
              key={n.id}
              to="/tasks/$id"
              params={{ id: n.taskId }}
              onClick={() => markNotificationRead(n.id)}
              className={`block rounded-md border p-3 hover:bg-accent transition ${n.read ? "" : "border-primary/40 bg-primary/5"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">{n.message}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "PPp")}</div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
