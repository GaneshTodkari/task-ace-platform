import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Network,
  BookMarked,
  Bell,
  PlusCircle,
  LogOut,
  CheckSquare,
  Building2,
  FolderKanban,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  if (!user) return null;
  const role = user.role;

  const taskItems =
    role === "admin"
      ? []
      : [
          { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
          { title: "Tasks", url: "/tasks", icon: ListTodo },
          ...(role === "manager" || role === "team_lead"
            ? [{ title: "Team", url: "/team", icon: Users }]
            : []),
          ...(role === "manager" ? [{ title: "Projects", url: "/admin/projects", icon: FolderKanban }] : []),
          { title: "Notifications", url: "/notifications", icon: Bell },
        ];

  const adminItems =
    role === "admin"
      ? [
          { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
          { title: "Departments", url: "/admin/departments", icon: Building2 },
          { title: "Projects", url: "/admin/projects", icon: FolderKanban },
          { title: "Users", url: "/admin/users", icon: Users },
          { title: "Hierarchy", url: "/admin/hierarchy", icon: Network },
          { title: "Predefined Tasks", url: "/admin/predefined", icon: BookMarked },
        ]
      : [];

  const items = [...taskItems, ...adminItems];
  const canCreate = role !== "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CheckSquare className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-none">TaskFlow</span>
            <span className="text-xs text-muted-foreground mt-0.5">Workforce tasks</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {canCreate && (
          <div className="px-2 group-data-[collapsible=icon]:hidden">
            <Button className="w-full justify-start gap-2" onClick={() => navigate({ to: "/tasks/new" })}>
              <PlusCircle className="size-4" /> Create Task
            </Button>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={path === it.url || path.startsWith(it.url + "/")}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="size-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
            <span className="text-sm font-medium truncate">{user.fullName}</span>
            <span className="text-xs text-muted-foreground capitalize">{user.role.replace("_", " ")}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              logout();
              navigate({ to: "/auth" });
            }}
            title="Log out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
