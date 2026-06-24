import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import {
  getTask,
  canSeeTask,
  updateTaskStatus,
  addComment,
  addAttachment,
  rateTask,
  canRate,
  reassignTask,
  listUsers,
} from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { RatingStars } from "@/components/rating-stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneePicker } from "@/components/assignee-picker";
import { ArrowLeft, Paperclip, Upload } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TaskStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  useDBVersion();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [newAssignees, setNewAssignees] = useState<string[]>([]);

  const task = getTask(id);
  if (!user) return null;
  if (!task || !canSeeTask(user, task)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Task not found or you don't have access.</p>
        <Button asChild variant="link"><Link to="/tasks">Back to tasks</Link></Button>
      </div>
    );
  }

  const users = listUsers();
  const userById = (id: string) => users.find((u) => u.id === id);
  const isAssignee = task.assigneeIds.includes(user.id);
  const isCreator = task.createdBy === user.id;

  const onStatus = (s: TaskStatus) => {
    updateTaskStatus(task.id, s, user);
    toast.success("Status updated");
  };

  const onComment = () => {
    if (!comment.trim()) return;
    addComment(task.id, comment.trim(), user);
    setComment("");
  };

  const onUpload = (fs: FileList | null) => {
    if (!fs) return;
    Array.from(fs).forEach((f) => {
      const r = new FileReader();
      r.onload = () => addAttachment(task.id, { fileName: f.name, dataUrl: String(r.result) }, user);
      r.readAsDataURL(f);
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tasks" })} className="-ml-2">
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {task.category}{task.subCategory ? ` · ${task.subCategory}` : ""} · Due {format(new Date(task.deadline), "PPp")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {task.description && (
            <Card>
              <CardHeader><CardTitle>Description</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{task.description}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {task.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              {task.comments.map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    {userById(c.userId)?.fullName ?? "Unknown"} · {format(new Date(c.createdAt), "PPp")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              {(isAssignee || isCreator) && (
                <div className="space-y-2">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add a comment…" />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={onComment}>Post comment</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {task.attachments.length === 0 && <p className="text-sm text-muted-foreground">No attachments.</p>}
              <ul className="space-y-1.5">
                {task.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate"><Paperclip className="size-4" /> {a.fileName}</span>
                    <a href={a.dataUrl} download={a.fileName} className="text-primary text-xs hover:underline">Download</a>
                  </li>
                ))}
              </ul>
              {(isAssignee || isCreator) && (
                <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-3 cursor-pointer hover:bg-accent text-sm">
                  <Upload className="size-4" /> Add attachment
                  <input type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity log</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {[...task.activity].reverse().map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <div className="text-xs text-muted-foreground w-36 shrink-0">{format(new Date(a.createdAt), "PPp")}</div>
                    <div>
                      <span className="font-medium">{userById(a.userId)?.fullName ?? "Unknown"}</span>{" "}
                      <span className="text-muted-foreground">{a.action.replace("_", " ")}</span>
                      {a.details && <span className="text-muted-foreground"> · {a.details}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(isAssignee || isCreator) ? (
                <Select value={task.status} onValueChange={(v) => onStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not started</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge status={task.status} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>People</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Created by</div>
                <div>{userById(task.createdBy)?.fullName}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Assignees</div>
                <ul className="space-y-1">
                  {task.assigneeIds.map((aid) => (
                    <li key={aid}>{userById(aid)?.fullName ?? aid}</li>
                  ))}
                </ul>
              </div>
              {isCreator && (
                <div className="pt-2 border-t">
                  {!reassigning ? (
                    <Button size="sm" variant="outline" onClick={() => { setNewAssignees(task.assigneeIds); setReassigning(true); }}>
                      Reassign
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <AssigneePicker selected={newAssignees} onChange={setNewAssignees} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setReassigning(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => {
                          reassignTask(task.id, newAssignees, user);
                          setReassigning(false);
                          toast.success("Reassigned");
                        }}>Save</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rating</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {task.rating ? (
                <RatingStars value={task.rating} readOnly />
              ) : (
                <p className="text-sm text-muted-foreground">Not rated yet.</p>
              )}
              {canRate(user, task) && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Rate assignee performance:</p>
                  <RatingStars value={task.rating ?? 0} onChange={(v) => { rateTask(task.id, v, user); toast.success("Rating saved"); }} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
