import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import {
  listDepartments, listProjects, createProject, updateProject,
  archiveProject, setProjectActive, deleteProject, departmentById,
  canManageProject, canDeleteOrArchiveProject, departmentByName,
} from "@/lib/api";
import type { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { user } = useAuth();
  useDBVersion();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all");

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return <p className="text-muted-foreground">Restricted.</p>;
  }

  const isAdmin = user.role === "admin";
  const departments = listDepartments(true);
  const allProjects = listProjects();
  const managerDeptId = user.role === "manager" ? (user.departmentId ?? departmentByName(user.department)?.id ?? "") : "";
  const projects = useMemo(() => {
    let list = allProjects;
    if (!isAdmin) list = list.filter((p) => p.departmentId === managerDeptId);
    if (filterDept !== "all") list = list.filter((p) => p.departmentId === filterDept);
    return list;
  }, [allProjects, isAdmin, managerDeptId, filterDept]);

  const openCreate = () => {
    setEditing(null); setName("");
    setDeptId(isAdmin ? (departments[0]?.id ?? "") : managerDeptId);
    setOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p); setName(p.name); setDeptId(p.departmentId); setOpen(true);
  };

  const save = () => {
    if (!name.trim() || !deptId) { toast.error("Name and department required"); return; }
    if (!isAdmin && deptId !== managerDeptId) { toast.error("Managers can only manage their department"); return; }
    if (editing) {
      if (!canManageProject(user, editing)) { toast.error("Not permitted"); return; }
      updateProject(editing.id, { name: name.trim(), departmentId: deptId });
      toast.success("Updated");
    } else {
      createProject({ name: name.trim(), departmentId: deptId });
      toast.success("Created");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage all projects and archives." : "Create and edit projects within your department."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-1" />Add project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={deptId} onValueChange={setDeptId} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All projects</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{p.name}</td>
                  <td className="py-2 pr-3">{departmentById(p.departmentId)?.name ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {p.isArchived ? <Badge variant="outline">Archived</Badge>
                      : p.isActive ? <Badge variant="secondary">Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-1 flex-wrap">
                      {canManageProject(user, p) && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                      )}
                      {canDeleteOrArchiveProject(user) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setProjectActive(p.id, !p.isActive)}>
                            {p.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => archiveProject(p.id, !p.isArchived)}>
                            {p.isArchived ? "Restore" : "Archive"}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete project?")) deleteProject(p.id); }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
