import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AssigneePicker } from "@/components/assignee-picker";
import { PriorityBadge } from "@/components/badges";
import {
  listPredefined,
  createTask,
  listProjects,
  departmentByName,
  projectById,
  assignedByOptions,
  isFileAllowed,
} from "@/lib/api";
import type { Priority, RecurrencePattern, TaskType } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Upload, X, Repeat, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTask,
});

type Step = "type" | "form";

function NewTask() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("type");
  const [taskType, setTaskType] = useState<TaskType>("one_time");
  // one-time only
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
  const [pattern, setPattern] = useState<RecurrencePattern>("weekly");
  const [customDays, setCustomDays] = useState<number>(7);
  const [monthlyDay, setMonthlyDay] = useState<number>(1);
  const [reminders, setReminders] = useState<{ description: string; remindAt: string }[]>([]);
  const [remDesc, setRemDesc] = useState("");
  const [remAt, setRemAt] = useState("");
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const weekdays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

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
      return proj && proj.departmentId === deptObj?.id && (projectId ? proj.id === projectId : true);
    }),
    [deptObj, projectId],
  );

  if (!user) return null;
  const assignedByOpts = assignedByOptions(user);

  const onPickPredefined = (id: string) => {
    setPredefinedId(id);
    const p = predefined.find((x) => x.id === id);
    if (p) {
      setTitle(p.title);
      setPriority(p.defaultPriority);
      setComments(p.defaultComments ?? "");
    }
  };

  const onFileChange = (fs: FileList | null) => {
    if (!fs) return;
    Array.from(fs).forEach((f) => {
      const check = isFileAllowed(f.name);
      if (!check.ok) { toast.error(check.error ?? "File not allowed"); return; }
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

  const canSubmit =
  title.trim() &&
  projectId &&
  (taskType === "recurring" || !!deadline) &&
  (pattern !== "weekly" || weeklyDays.length > 0) &&
  effectiveAssignees.length > 0 &&
  (selfAssign && user.role === "manager"
    ? true
    : !selfAssign || !!assignedBy);

  const submit = () => {
    if (!canSubmit) {
      toast.error("Fill mandatory fields and pick assignees.");
      return;
    }
    
    createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
        priority,
        deadline,
        assigneeIds: effectiveAssignees,
        assignedBy: selfAssign && user.role !== "manager" ? assignedBy : undefined,
        comments: comments.trim() || undefined,
        attachments: files,
        taskType,

        isRecurring: taskType === "recurring",

        recurrencePattern:
          taskType === "recurring"
            ? pattern
            : undefined,

        weeklyDays:
          taskType === "recurring" &&
          pattern === "weekly"
            ? weeklyDays
            : undefined,
            
        customRecurrenceDays:
          taskType === "recurring" &&
          pattern === "custom"
            ? customDays
            : undefined,

        recurrenceDayOfMonth:
          taskType === "recurring" &&
          pattern === "monthly"
            ? monthlyDay
            : undefined,

        reminders,
    }, user);
    toast.success("Task created");
    navigate({ to: "/tasks" });
  };

  if (step === "type") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/tasks"><ArrowLeft className="size-4 mr-1" /> Back to tasks</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">Create a task</h1>
          <p className="text-muted-foreground">Choose the task type to begin.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => { setTaskType("one_time"); setStep("form"); }}
            className="group text-left rounded-lg border bg-card p-6 hover:border-primary hover:shadow-sm transition"
          >
            <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <ClipboardList className="size-5" />
            </div>
            <div className="font-medium group-hover:text-primary">One Time Task</div>
            <div className="text-sm text-muted-foreground mt-1">A task performed once. Optionally start from a predefined template.</div>
          </button>
          <button
            type="button"
            onClick={() => { setTaskType("recurring"); setMode("manual"); setStep("form"); }}
            className="group text-left rounded-lg border bg-card p-6 hover:border-primary hover:shadow-sm transition"
          >
            <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Repeat className="size-5" />
            </div>
            <div className="font-medium group-hover:text-primary">Recurring Task</div>
            <div className="text-sm text-muted-foreground mt-1">Repeats on a pattern. A new instance is generated after each cycle closes.</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => setStep("type")} className="-ml-2">
          <ArrowLeft className="size-4 mr-1" /> Change task type
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          New {taskType === "recurring" ? "Recurring" : "One Time"} Task
        </h1>
      </div>

      {taskType === "one_time" && (
        <Card>
          <CardHeader>
            <CardTitle>Sub-type</CardTitle>
            <CardDescription>Start from a predefined template or enter details manually.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant={mode === "predefined" ? "default" : "outline"} size="sm" onClick={() => setMode("predefined")}>Predefined Task</Button>
              <Button variant={mode === "manual" ? "default" : "outline"} size="sm" onClick={() => setMode("manual")}>Manual Task</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Task details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Department">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {dept} <span className="text-xs text-muted-foreground">(auto-filled)</span>
            </div>
          </Field>

          <Field label="Project *">
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setPredefinedId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {taskType === "one_time" && mode === "predefined" && projectId && (
            <Field label="Predefined Task">
              <Select value={predefinedId} onValueChange={onPickPredefined}>
                <SelectTrigger><SelectValue placeholder="Choose a predefined task" /></SelectTrigger>
                <SelectContent>
                  {predefined.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

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
            {taskType === "one_time" && (
              <Field label="Due Date *">
                  <Input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                  />
              </Field>
          )}
          </div>
          <Field label="Description">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {taskType === "recurring" && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="text-sm font-medium">Recurrence Pattern *</div>
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

                {pattern === "monthly" && (
                  <Field label="Day of Month">
                  <Select
                    value={monthlyDay.toString()}
                    onValueChange={(v) => setMonthlyDay(Number(v))}
                  >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={(i + 1).toString()}
                          >
                            {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {pattern === "weekly" && (
                <Field label="Repeat On">
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={weeklyDays.includes(day) ? "default" : "outline"}
                        onClick={() =>
                          setWeeklyDays((prev) =>
                            prev.includes(day)
                              ? prev.filter((d) => d !== day)
                              : [...prev, day]
                          )
                        }
                      >
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </Button>
                    ))}
                  </div>
                </Field>
              )}

                {pattern === "custom" && (
                  <Field label="Every N Days">
                    <Input
                      type="number"
                      min={1}
                      value={customDays}
                      onChange={(e) => setCustomDays(Number(e.target.value))}
                    />
                  </Field>
                )}
                                
              </div>
            </div>
          )}

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
