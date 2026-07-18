import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import {
  archivePredefined,
  listPredefined,
  listProjects,
  projectById,
  upsertPredefined,
  departmentById,
  canManagePredefined,
  canDeleteOrArchivePredefined,
} from "@/lib/api";
import type { PredefinedTask, Priority } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/predefined")({
  component: PredefinedPage,
});

const empty = {
  id: "",
  title: "",
  projectId: "",
  defaultPriority: "medium" as Priority,
  defaultComments: "",
  isArchived: false,
};

function PredefinedPage() {
  const { user } = useAuth();
  useDBVersion();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PredefinedTask | null>(null);
  const [form, setForm] = useState(empty);

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return <p className="text-muted-foreground">Not permitted.</p>;
  }

  const isAdmin = user.role === "admin";
  const canDelete = canDeleteOrArchivePredefined(user);

  // Scope: admin sees all, manager sees own dept only
  const allProjects = listProjects({ activeOnly: true });
  const projects = useMemo(
    () => isAdmin ? allProjects : allProjects.filter((p) => p.departmentId === user.departmentId),
    [allProjects, isAdmin, user.departmentId],
  );
  const all = useMemo(
    () => listPredefined(false).filter((p) => {
      if (isAdmin) return true;
      const proj = projectById(p.projectId);
      return !!proj && proj.departmentId === user.departmentId;
    }),
    [isAdmin, user.departmentId],
  );

  const openCreate = () => {
  setEditing(null);
  setForm({ ...empty });
  setOpen(true);
};
  const openEdit = (p: PredefinedTask) => {
  if (!canManagePredefined(user, p)) {
    toast.error("Not permitted");
    return;
  }

  setEditing(p);

  setForm({
    id: p.id,
    title: p.title,
    projectId: p.projectId,
    defaultPriority: p.defaultPriority,
    defaultComments: p.defaultComments ?? "",
    isArchived: p.isArchived,
  });

  setOpen(true);
};

  const save = () => {
    if (!form.id || !form.title || !form.projectId) {
      toast.error("Task Code, Title and Project are required");
      return;
    }
    // Manager: project must be in own department
    if (!isAdmin) {
      const proj = projectById(form.projectId);
      if (!proj || proj.departmentId !== user.departmentId) {
        toast.error("Project must be in your department");
        return;
      }
    }
    upsertPredefined({
    ...form,
    id: editing ? editing.id : form.id,
});
    toast.success(editing ? "Updated" : "Added");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Predefined tasks</h1>
          <p className="text-muted-foreground">
            Reusable task templates per project{!isAdmin && ` · ${user.department}`}.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="size-4 mr-1" />Add template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Task Code">
  <Input
    placeholder="RAD-TSK-001"
    value={form.id}
    disabled={!!editing}
    onChange={(e) =>
      setForm({
        ...form,
        id: e.target.value.toUpperCase(),
      })
    }
  />
</Field>

<Field label="Task Title">
  <Input
    value={form.title}
    onChange={(e) =>
      setForm({
        ...form,
        title: e.target.value,
      })
    }
  />
</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Project">
                  <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default priority">
                  <Select value={form.defaultPriority} onValueChange={(v) => setForm({ ...form, defaultPriority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Default comments"><Textarea rows={3} value={form.defaultComments} onChange={(e) => setForm({ ...form, defaultComments: e.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Library</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {all.map((p) => {
                  const proj = projectById(p.projectId);
                  const dep = departmentById(proj?.departmentId);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">
  {p.id}
</td>

<td className="py-2 pr-3 font-medium">
  {p.title}
</td>
                      <td className="py-2 pr-3">{proj?.name ?? "—"}</td>
                      <td className="py-2 pr-3">{dep?.name ?? "—"}</td>
                      <td className="py-2 pr-3 capitalize">{p.defaultPriority}</td>
                      <td className="py-2 pr-3">
                        {p.isArchived ? <Badge variant="outline">Archived</Badge> : <Badge variant="secondary">Active</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                          {canDelete && (
                            <Button size="sm" variant="outline" onClick={() => archivePredefined(p.id, !p.isArchived)}>
                              {p.isArchived ? "Restore" : "Archive"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
