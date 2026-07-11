import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AssigneePicker } from "@/components/assignee-picker";
import { PriorityBadge } from "@/components/badges";
import {
  listPredefined,
  createTask,
  listUsers,
  listProjects,
  departmentByName,
  projectById,
  assignedByOptions,
} from "@/lib/api";
import type { Priority, RecurrencePattern } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTask,
});

function NewTask() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"predefined" | "manual">("manual");
  const [predefinedId, setPredefinedId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [selfAssign, setSelfAssign] = useState(false);
  const [assignedBy, setAssignedBy] = useState<string>("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<{ fileName: string; dataUrl: string }[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [pattern, setPattern] = useState<RecurrencePattern>("weekly");
  const [customDays, setCustomDays] = useState<number>(7);
  const [reminders, setReminders] = useState<{ description: string; remindAt: string }[]>([]);
  const [remDesc, setRemDesc] = useState("");
  const [remAt, setRemAt] = useState("");

  useEffect(() => {
    if (user && user.role === "admin") navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const dept = user?.department ?? "";
  const deptObj = useMemo(() => (dept ? departmentByName(dept) : null), [dept]);
  const projects = useMemo(
    () => (deptObj ? listProjects({ departmentId: deptObj.id, activeOnly: true }) : []),
    [deptObj],
  );
  const predefined = useMemo(
    () => listPredefined().filter((p) => {
      const proj = projectById(p.projectId);
      return proj && proj.departmentId === deptObj?.id;
    }),
    [deptObj],
  );

  if (!user) return null;

  const assignedByOpts = assignedByOptions(user);

  const onPickPredefined = (id: string) => {
    setPredefinedId(id);
    const p = predefined.find((x) => x.id === id);
    if (p) {
      setTitle(p.title);
      setProjectId(p.projectId);
      setPriority(p.defaultPriority);
      setComments(p.defaultComments ?? "");
    }
  };

  const onFileChange = (fs: FileList | null) => {
    if (!fs) return;
    Array.from(fs).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setFiles((cur) => [...cur, { fileName: f.name, dataUrl: String(reader.result) }]);
      reader.readAsDataURL(f);
    });
  };

  const addReminderRow = () => {
    if (!remDesc.trim() || !remAt) return;
    setReminders((cur) => [...cur, { description: remDesc.trim(), remindAt: remAt }]);
    setRemDesc(""); setRemAt("");
  };

  const effectiveAssignees = selfAssign ? [user.id] : assigneeIds;

  const canSubmit = title.trim() && projectId && deadline && effectiveAssignees.length > 0
    && (selfAssign && user.role === "manager" ? true : !selfAssign || !!assignedBy);

  const submit = () => {
    if (!canSubmit) {
      toast.error("Fill mandatory fields and pick assignees.");
      return;
    }
    createTask(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
        priority,
        deadline,
        assigneeIds: effectiveAssignees,
        assignedBy: selfAssign && user.role !== "manager" ? assignedBy : undefined,
        comments: comments.trim() || undefined,
        attachments: files,
        isRecurring,
        recurrencePattern: isRecurring ? pattern : undefined,
        customRecurrenceDays: isRecurring && pattern === "custom" ? customDays : undefined,
        reminders,
      },
      user,
    );
    toast.success("Task created");
    navigate({ to: "/tasks" });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/tasks"><ArrowLeft className="size-4 mr-1" /> Back to tasks</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Create a task</h1>
        <p className="text-muted-foreground">Start from a predefined template or enter details manually.</p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="predefined">Predefined</TabsTrigger>
          <TabsTrigger value="manual">Manual entry</TabsTrigger>
        </TabsList>

        <TabsContent value="predefined" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pick from library</CardTitle>
              <CardDescription>Templates for your department's projects.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={predefinedId} onValueChange={onPickPredefined}>
                <SelectTrigger><SelectValue placeholder="Choose a predefined task" /></SelectTrigger>
                <SelectContent>
                  {predefined.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} <span className="text-muted-foreground">· {projectById(p.projectId)?.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manual" />
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Task details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Department">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{dept} <span className="text-xs text-muted-foreground">(auto-filled)</span></div>
          </Field>
          <Field label="Project *">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority *">
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due Date *">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Self-assign</div>
                <div className="text-xs text-muted-foreground">Create this task for yourself.</div>
              </div>
              <Switch checked={selfAssign} onCheckedChange={setSelfAssign} />
            </div>
            {selfAssign && user.role !== "manager" && (
              <Field label="Assigned By *">
                <Select value={assignedBy} onValueChange={setAssignedBy}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {assignedByOpts.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role.replace("_", " ")})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          {!selfAssign && (
            <Field label="Assignees * (your direct & indirect reports)">
              <AssigneePicker selected={assigneeIds} onChange={setAssigneeIds} />
            </Field>
          )}

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Recurring task</div>
                <div className="text-xs text-muted-foreground">Auto-create the next instance when closed.</div>
              </div>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
            {isRecurring && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pattern">
                  <Select value={pattern} onValueChange={(v) => setPattern(v as RecurrencePattern)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {pattern === "custom" && (
                  <Field label="Every N days">
                    <Input type="number" min={1} value={customDays} onChange={(e) => setCustomDays(Number(e.target.value))} />
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">Reminders</div>
            {reminders.length > 0 && (
              <ul className="space-y-1">
                {reminders.map((r, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                    <span>{r.description} · {r.remindAt}</span>
                    <button type="button" onClick={() => setReminders((cur) => cur.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <Input placeholder="Reminder description" value={remDesc} onChange={(e) => setRemDesc(e.target.value)} />
              <Input type="date" value={remAt} onChange={(e) => setRemAt(e.target.value)} />
              <Button type="button" variant="outline" onClick={addReminderRow}><Plus className="size-4 mr-1" />Add</Button>
            </div>
          </div>

          <Field label="Comments">
            <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
          </Field>
          <Field label="Attachments">
            <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-4 cursor-pointer hover:bg-accent">
              <Upload className="size-4" />
              <span className="text-sm">Click to upload files</span>
              <input type="file" multiple className="hidden" onChange={(e) => onFileChange(e.target.files)} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm rounded-md border px-3 py-1.5">
                    <span className="truncate">{f.fileName}</span>
                    <button onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          {selfAssign && (
            <div className="text-xs text-muted-foreground">
              Priority <PriorityBadge priority={priority} /> · You will be the assignee.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link to="/tasks">Cancel</Link></Button>
        <Button onClick={submit} disabled={!canSubmit}>Create task</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
