import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listNotifications } from "@/lib/api";
import { useDBVersion } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDBVersion();

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
  }, [user, navigate]);

  if (!user) return null;

  const unread = listNotifications(user.id).filter((n) => !n.read).length;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="h-14 flex items-center gap-2 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            {user.role !== "admin" && (
              <Link
                to="/notifications"
                className="relative rounded-md p-2 hover:bg-accent"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute top-0 right-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            )}
          </header>
          <main className="p-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
