import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { archivePredefined, listPredefined, upsertPredefined } from "@/lib/api";
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
  title: "", category: "", subCategory: "", defaultPriority: "medium" as Priority,
  department: "Engineering", defaultComments: "", isArchived: false,
};

function PredefinedPage() {
  const { user } = useAuth();
  useDBVersion();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PredefinedTask | null>(null);
  const [form, setForm] = useState(empty);

  if (!user || user.role !== "admin") return <p className="text-muted-foreground">Admin only.</p>;
  const all = listPredefined(false);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: PredefinedTask) => {
    setEditing(p);
    setForm({
      title: p.title, category: p.category, subCategory: p.subCategory ?? "",
      defaultPriority: p.defaultPriority, department: p.department,
      defaultComments: p.defaultComments ?? "", isArchived: p.isArchived,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.title || !form.category || !form.department) {
      toast.error("Title, category and department are required");
      return;
    }
    upsertPredefined({ ...form, id: editing?.id });
    toast.success(editing ? "Updated" : "Added");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Predefined tasks</h1>
          <p className="text-muted-foreground">Reusable task templates per department. Changes appear instantly in task creation.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="size-4 mr-1" />Add template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
                <Field label="Sub-category"><Input value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} /></Field>
                <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
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
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {all.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.title}</td>
                    <td className="py-2 pr-3">{p.department}</td>
                    <td className="py-2 pr-3">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ""}</td>
                    <td className="py-2 pr-3 capitalize">{p.defaultPriority}</td>
                    <td className="py-2 pr-3">
                      {p.isArchived ? <Badge variant="outline">Archived</Badge> : <Badge variant="secondary">Active</Badge>}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => archivePredefined(p.id, !p.isArchived)}>
                          {p.isArchived ? "Restore" : "Archive"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
