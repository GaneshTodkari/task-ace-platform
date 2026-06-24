import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { listUsers, createUser, updateUser, deactivateUser, activateUser } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const empty = {
  fullName: "",
  employeeId: "",
  email: "",
  password: "demo",
  role: "reportee" as Role,
  department: "Engineering",
  managerId: "",
  isActive: true,
};

function AdminUsers() {
  const { user } = useAuth();
  useDBVersion();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(empty);

  if (!user || user.role !== "admin") return <p className="text-muted-foreground">Admin only.</p>;
  const users = listUsers();

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      fullName: u.fullName, employeeId: u.employeeId, email: u.email, password: u.password,
      role: u.role, department: u.department, managerId: u.managerId ?? "", isActive: u.isActive,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.fullName || !form.email || !form.employeeId) {
      toast.error("Name, email and employee ID are required");
      return;
    }
    const payload = { ...form, managerId: form.managerId || null };
    if (editing) {
      updateUser(editing.id, payload);
      toast.success("User updated");
    } else {
      createUser(payload as any);
      toast.success("User created");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Create, edit and deactivate users. Assign their reporting manager.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="size-4 mr-1" />Add user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
                <Field label="Employee ID"><Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></Field>
                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Password"><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
                <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
                <Field label="Role">
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="reportee">Reportee</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reporting manager">
                  <Select value={form.managerId || "none"} onValueChange={(v) => setForm({ ...form, managerId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.filter((u) => !editing || u.id !== editing.id).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save changes" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Emp ID</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Dept</th>
                  <th className="py-2 pr-3">Manager</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{u.fullName}</td>
                    <td className="py-2 pr-3">{u.employeeId}</td>
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3 capitalize">{u.role.replace("_", " ")}</td>
                    <td className="py-2 pr-3">{u.department}</td>
                    <td className="py-2 pr-3">{users.find((x) => x.id === u.managerId)?.fullName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {u.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => u.isActive ? deactivateUser(u.id) : activateUser(u.id)}>
                          {u.isActive ? "Deactivate" : "Activate"}
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
