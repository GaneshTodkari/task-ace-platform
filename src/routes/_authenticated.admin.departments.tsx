import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import {
  listDepartments, createDepartment, updateDepartment, setDepartmentActive,
  listProjects, listTasks,
} from "@/lib/api";
import type { Department } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { user } = useAuth();
  useDBVersion();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");

  if (!user || user.role !== "admin") return <p className="text-muted-foreground">Admin only.</p>;

  const departments = listDepartments();
  const projects = listProjects();
  const tasks = listTasks();

  const openCreate = () => { setEditing(null); setName(""); setOpen(true); };
  const openEdit = (d: Department) => { setEditing(d); setName(d.name); setOpen(true); };

  const save = () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    if (editing) { updateDepartment(editing.id, { name: name.trim() }); toast.success("Updated"); }
    else { createDepartment(name.trim()); toast.success("Created"); }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">Departments group projects. Deactivate rather than delete.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-1" />Add department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit department" : "New department"}</DialogTitle></DialogHeader>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All departments</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Projects</th>
                <th className="py-2 pr-3">Tasks</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const projs = projects.filter((p) => p.departmentId === d.id);
                const tks = tasks.filter((t) => projs.some((p) => p.id === t.projectId));
                return (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{d.name}</td>
                    <td className="py-2 pr-3">{projs.length}</td>
                    <td className="py-2 pr-3">{tks.length}</td>
                    <td className="py-2 pr-3">
                      {d.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setDepartmentActive(d.id, !d.isActive)}>
                          {d.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
