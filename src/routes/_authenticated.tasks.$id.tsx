import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import {
  getTask,
  canSeeTask,
  updateAssignmentStatus,
  addComment,
  addAttachment,
  listUsers,
  canReviewClose,
  requestExtension,
  decideExtension,
  addReminder,
  deleteReminder,
  projectById,
} from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { RatingStars } from "@/components/rating-stars";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Paperclip, Upload, Trash2, Plus, Bell } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TaskAssignment, TaskStatus, Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  useDBVersion();
  const navigate = useNavigate();

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
  const project = projectById(task.projectId);

  // decide which assignments to expose to this user
  const isCreator = task.createdBy === user.id;
  const isReviewer = task.assignments.some((a) => canReviewClose(user, task, a));
  const visibleAssignments = task.assignments.filter((a) =>
    a.assigneeId === user.id || isCreator || canReviewClose(user, task, a),
  );

  const [activeId, setActiveId] = useState<string>(visibleAssignments[0]?.id ?? "");

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
              {project?.name ?? "—"} · {task.department} · Due {format(new Date(task.deadline), "PP")}
              {task.isRecurring && <Badge variant="outline" className="ml-2">Recurring · {task.recurrencePattern}</Badge>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
      </div>

      {task.description && (
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{task.description}</CardContent>
        </Card>
      )}

      <RemindersSection task={task} />

      {visibleAssignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No assignment visible to you.</p>
      ) : (
        <Tabs value={activeId} onValueChange={setActiveId}>
          <TabsList className="flex-wrap h-auto">
            {visibleAssignments.map((a) => (
              <TabsTrigger key={a.id} value={a.id} className="gap-2">
                {userById(a.assigneeId)?.fullName ?? a.assigneeId}
                <StatusBadge status={a.status} />
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleAssignments.map((a) => (
            <TabsContent key={a.id} value={a.id} className="pt-4">
              <AssignmentPanel task={task} assignment={a} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function RemindersSection({ task }: { task: Task }) {
  const { user } = useAuth();
  const [desc, setDesc] = useState("");
  const [at, setAt] = useState("");
  if (!user) return null;
  const canEdit = task.createdBy === user.id || task.assignments.some((a) => a.assigneeId === user.id);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4" /> Reminders</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {task.reminders.length === 0 && <p className="text-sm text-muted-foreground">No reminders.</p>}
        {task.reminders.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div>
              <div>{r.description}</div>
              <div className="text-xs text-muted-foreground">On {r.remindAt} {r.notified ? "· sent" : ""}</div>
            </div>
            {canEdit && (
              <button className="text-muted-foreground hover:text-destructive" onClick={() => deleteReminder(task.id, r.id)}>
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Input type="date" value={at} onChange={(e) => setAt(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => {
              if (!desc.trim() || !at) return;
              addReminder(task.id, desc.trim(), at);
              setDesc(""); setAt("");
            }}><Plus className="size-4 mr-1" />Add</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssignmentPanel({ task, assignment }: { task: Task; assignment: TaskAssignment }) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState("");
  const [rating, setRating] = useState(0);
  const [extOpen, setExtOpen] = useState(false);
  const [extReason, setExtReason] = useState("");
  const [extDate, setExtDate] = useState("");
  const [decideOpen, setDecideOpen] = useState<string | null>(null);
  const [decideComments, setDecideComments] = useState("");

  if (!user) return null;
  const users = listUsers();
  const userById = (id: string) => users.find((u) => u.id === id);
  const isAssignee = assignment.assigneeId === user.id;
  const reviewer = canReviewClose(user, task, assignment);
  const isClosed = assignment.status === "closed";
  const skipRating = task.isSelfAssignedManager && assignment.assigneeId === task.createdBy;

  const setStatus = (next: TaskStatus, extra?: { onHoldReason?: string; reviewComments?: string; rating?: number }) => {
    const res = updateAssignmentStatus(task.id, assignment.id, next, user, extra);
    if (!res.ok) toast.error(res.error ?? "Not permitted");
    else toast.success("Status updated");
  };

  const onComment = () => {
    if (!comment.trim() || isClosed) return;
    addComment(task.id, assignment.id, comment.trim(), user);
    setComment("");
  };

  const onUpload = (fs: FileList | null) => {
    if (!fs || isClosed) return;
    Array.from(fs).forEach((f) => {
      const r = new FileReader();
      r.onload = () => addAttachment(task.id, assignment.id, { fileName: f.name, dataUrl: String(r.result) }, user);
      r.readAsDataURL(f);
    });
  };

  const pendingExt = assignment.extensionRequests.filter((e) => e.status === "pending");

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            {isClosed && <CardDescription>This assignment is closed and read-only.</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={assignment.status} />
              {assignment.status === "on_hold" && assignment.onHoldReason && (
                <span className="text-xs text-muted-foreground">Reason: {assignment.onHoldReason}</span>
              )}
            </div>
            {!isClosed && isAssignee && (
              <div className="flex flex-wrap gap-2">
                {assignment.status !== "in_progress" && (
                  <Button size="sm" onClick={() => setStatus("in_progress")}>Start / Resume</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setHoldOpen(true)}>Put On Hold</Button>
                {assignment.status !== "submitted_for_review" && (
                  <Button size="sm" onClick={() => setStatus("submitted_for_review")}>Submit for Review</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setExtOpen(true)}>Request Extension</Button>
              </div>
            )}
            {!isClosed && reviewer && assignment.status === "submitted_for_review" && (
              <div className="pt-2 border-t">
                <Button size="sm" onClick={() => setCloseOpen(true)}>Review & Close</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {pendingExt.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Extension Requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingExt.map((er) => (
                <div key={er.id} className="rounded-md border p-3 space-y-2">
                  <div className="text-sm"><span className="font-medium">{userById(er.requestedBy)?.fullName}</span> requested extension to <span className="font-medium">{er.proposedDeadline}</span></div>
                  <div className="text-sm text-muted-foreground">Reason: {er.reason}</div>
                  {reviewer && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setDecideOpen(er.id + ":accepted")}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => setDecideOpen(er.id + ":rejected")}>Reject</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignment.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {assignment.comments.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  {userById(c.userId)?.fullName ?? "Unknown"} · {format(new Date(c.createdAt), "PPp")}
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
            {!isClosed && (isAssignee || reviewer) && (
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
            {assignment.attachments.length === 0 && <p className="text-sm text-muted-foreground">No attachments.</p>}
            <ul className="space-y-1.5">
              {assignment.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 truncate"><Paperclip className="size-4" /> {a.fileName}</span>
                  <a href={a.dataUrl} download={a.fileName} className="text-primary text-xs hover:underline">Download</a>
                </li>
              ))}
            </ul>
            {!isClosed && (isAssignee || reviewer) && (
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
              {[...assignment.activity].reverse().map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="text-xs text-muted-foreground w-36 shrink-0">{format(new Date(a.createdAt), "PPp")}</div>
                  <div>
                    <span className="font-medium">{userById(a.userId)?.fullName ?? "Unknown"}</span>{" "}
                    <span className="text-muted-foreground">{a.action.replace(/_/g, " ")}</span>
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
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Assignee</div>
              <div>{userById(assignment.assigneeId)?.fullName}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Created by</div>
              <div>{userById(task.createdBy)?.fullName}</div>
            </div>
            {task.assignedBy && (
              <div>
                <div className="text-muted-foreground text-xs">Assigned by</div>
                <div>{userById(task.assignedBy)?.fullName}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {assignment.status === "closed" && (
          <Card>
            <CardHeader><CardTitle>Review</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assignment.reviewComments && (
                <div>
                  <div className="text-xs text-muted-foreground">Review comments</div>
                  <div>{assignment.reviewComments}</div>
                </div>
              )}
              {assignment.rating != null ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Rating</div>
                  <RatingStars value={assignment.rating} readOnly />
                </div>
              ) : (
                <p className="text-muted-foreground">Rating not required.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* On Hold Dialog */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Put On Hold</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea rows={3} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!holdReason.trim()) { toast.error("Reason required"); return; }
              setStatus("on_hold", { onHoldReason: holdReason.trim() });
              setHoldOpen(false); setHoldReason("");
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close (review) Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review & Close</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Review comments *</Label>
              <Textarea rows={3} value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} />
            </div>
            {!skipRating && (
              <div className="space-y-1.5">
                <Label>Performance rating</Label>
                <RatingStars value={rating} onChange={setRating} />
              </div>
            )}
            {skipRating && <p className="text-xs text-muted-foreground">Self-assigned Manager tasks skip the rating step.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!reviewComments.trim()) { toast.error("Review comments required"); return; }
              if (!skipRating && (rating < 1 || rating > 5)) { toast.error("Please provide a rating 1–5"); return; }
              setStatus("closed", { reviewComments: reviewComments.trim(), rating: skipRating ? undefined : rating });
              setCloseOpen(false); setReviewComments(""); setRating(0);
            }}>Close task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extension request Dialog */}
      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Deadline Extension</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea rows={3} value={extReason} onChange={(e) => setExtReason(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Proposed new deadline *</Label>
              <Input type="date" value={extDate} onChange={(e) => setExtDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!extReason.trim() || !extDate) { toast.error("Both fields required"); return; }
              requestExtension(task.id, assignment.id, extReason.trim(), extDate, user);
              setExtOpen(false); setExtReason(""); setExtDate("");
              toast.success("Extension requested");
            }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extension decision Dialog */}
      <Dialog open={!!decideOpen} onOpenChange={(o) => !o && setDecideOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decision comments</DialogTitle></DialogHeader>
          <Textarea rows={3} value={decideComments} onChange={(e) => setDecideComments(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDecideOpen(null); setDecideComments(""); }}>Cancel</Button>
            <Button onClick={() => {
              if (!decideOpen) return;
              const [erId, decision] = decideOpen.split(":") as [string, "accepted" | "rejected"];
              decideExtension(task.id, assignment.id, erId, decision, decideComments, user);
              toast.success(`Extension ${decision}`);
              setDecideOpen(null); setDecideComments("");
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
