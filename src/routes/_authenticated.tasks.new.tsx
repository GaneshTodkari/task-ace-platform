import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AssigneePicker } from "@/components/assignee-picker";
import { PriorityBadge } from "@/components/badges";
import { listPredefined, createTask, listUsers } from "@/lib/api";
import type { Priority } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Upload, X } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTask,
});

function NewTask() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"predefined" | "manual">("predefined");
  const [predefinedId, setPredefinedId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<{ fileName: string; dataUrl: string }[]>([]);
  const [step, setStep] = useState<"form" | "summary">("form");

  const predefined = listPredefined();
  const dept = user?.department ?? "";

  useEffect(() => {
    if (user && user.role !== "manager" && user.role !== "team_lead") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  if (!user) return null;

  const onPickPredefined = (id: string) => {
    setPredefinedId(id);
    const p = predefined.find((x) => x.id === id);
    if (p) {
      setTitle(p.title);
      setCategory(p.category);
      setSubCategory(p.subCategory ?? "");
      setPriority(p.defaultPriority);
      setComments(p.defaultComments ?? "");
    }
  };

  const onFileChange = (fs: FileList | null) => {
    if (!fs) return;
    Array.from(fs).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () =>
        setFiles((cur) => [...cur, { fileName: f.name, dataUrl: String(reader.result) }]);
      reader.readAsDataURL(f);
    });
  };

  const canSubmit = title.trim() && category.trim() && deadline && assigneeIds.length > 0;

  const submit = () => {
    if (!canSubmit) {
      toast.error("Fill mandatory fields and pick at least one assignee.");
      return;
    }
    createTask(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim(),
        subCategory: subCategory.trim() || undefined,
        priority,
        deadline: new Date(deadline).toISOString(),
        department: dept,
        assigneeIds,
        comments: comments.trim() || undefined,
        attachments: files,
      },
      user,
    );
    toast.success("Task created");
    navigate({ to: "/tasks" });
  };

  const users = listUsers();
  const assigneeNames = useMemo(
    () => assigneeIds.map((id) => users.find((u) => u.id === id)?.fullName).filter(Boolean).join(", "),
    [assigneeIds, users],
  );

  if (step === "summary") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setStep("form")} className="-ml-2">
            <ArrowLeft className="size-4 mr-1" /> Back to edit
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">Confirm task</h1>
          <p className="text-muted-foreground">Review the details before creating.</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <Row label="Title" value={title} />
            <Row label="Category" value={category} />
            {subCategory && <Row label="Sub-category" value={subCategory} />}
            <Row label="Priority" value={<PriorityBadge priority={priority} />} />
            <Row label="Deadline" value={deadline ? format(new Date(deadline), "PPp") : "—"} />
            <Row label="Department" value={dept} />
            <Row label="Assignees" value={assigneeNames || "—"} />
            {description && <Row label="Description" value={description} />}
            {comments && <Row label="Comments" value={comments} />}
            {files.length > 0 && <Row label="Attachments" value={files.map((f) => f.fileName).join(", ")} />}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep("form")}>Edit</Button>
          <Button onClick={submit}>Confirm & create</Button>
        </div>
      </div>
    );
  }

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
              <CardDescription>Department: {dept}</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={predefinedId} onValueChange={onPickPredefined}>
                <SelectTrigger><SelectValue placeholder="Choose a predefined task" /></SelectTrigger>
                <SelectContent>
                  {predefined
                    .filter((p) => p.department === dept)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} <span className="text-muted-foreground">· {p.category}</span>
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
          <Field label="Title *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category *">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Sub-category">
              <Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
            </Field>
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
            <Field label="Deadline *">
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Assignees * (your direct & indirect reports)">
            <AssigneePicker selected={assigneeIds} onChange={setAssigneeIds} />
          </Field>
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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link to="/tasks">Cancel</Link></Button>
        <Button onClick={() => setStep("summary")} disabled={!canSubmit}>Review</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 border-b last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
