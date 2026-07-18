import { getDB, updateDB, uid } from "./mock-db";
import type {
  Task,
  TaskAssignment,
  TaskStatus,
  TaskType,
  Priority,
  User,
  PredefinedTask,
  Role,
  Department,
  Project,
  RecurrencePattern,
} from "./types";
import { getDescendants, getAncestors } from "./hierarchy";

// ---------- AUTH ----------
export function login(email: string, password: string): User | null {
  const db = getDB();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.isActive,
  );
  if (!user) return null;
  updateDB((d) => { d.currentUserId = user.id; });
  return user;
}
export function logout() { updateDB((d) => { d.currentUserId = null; }); }
export function getCurrentUser(): User | null {
  const db = getDB();
  if (!db.currentUserId) return null;
  return db.users.find((u) => u.id === db.currentUserId) ?? null;
}

// ---------- USERS ----------
export function listUsers() { return [...getDB().users]; }
export function createUser(data: Omit<User, "id">) {
  const id = uid("u");
  updateDB((d) => { d.users.push({ ...data, id }); });
  return id;
}
export function updateUser(id: string, patch: Partial<Omit<User, "id">>) {
  updateDB((d) => {
    const u = d.users.find((x) => x.id === id);
    if (u) Object.assign(u, patch);
  });
}
export function deactivateUser(id: string) { updateUser(id, { isActive: false }); }
export function activateUser(id: string) { updateUser(id, { isActive: true }); }

// ---------- DEPARTMENTS ----------
export function listDepartments(activeOnly = false): Department[] {
  const all = getDB().departments;
  return activeOnly ? all.filter((d) => d.isActive) : [...all];
}
export function createDepartment(input: { id: string; name: string }) {
  updateDB((d) => {
    d.departments.push({
      id: input.id,
      name: input.name,
      isActive: true,
    });
  });

  return input.id;
}
export function updateDepartment(id: string, patch: Partial<Omit<Department, "id">>) {
  updateDB((d) => {
    const dep = d.departments.find((x) => x.id === id);
    if (dep) Object.assign(dep, patch);
  });
}
export function setDepartmentActive(id: string, active: boolean) {
  updateDepartment(id, { isActive: active });
}
export function departmentById(id?: string) {
  if (!id) return null;
  return getDB().departments.find((d) => d.id === id) ?? null;
}
export function departmentByName(name: string) {
  return getDB().departments.find((d) => d.name === name) ?? null;
}

// ---------- PROJECTS ----------
export function listProjects(opts?: { departmentId?: string; activeOnly?: boolean }): Project[] {
  let all = [...getDB().projects];
  if (opts?.departmentId) all = all.filter((p) => p.departmentId === opts.departmentId);
  if (opts?.activeOnly) all = all.filter((p) => p.isActive && !p.isArchived);
  return all;
}
export function projectById(id?: string) {
  if (!id) return null;
  return getDB().projects.find((p) => p.id === id) ?? null;
}
export function createProject(input: {
    id: string;
    name: string;
    departmentId: string;
}) {
    updateDB((d) => {
        d.projects.push({
            id: input.id,
            name: input.name,
            departmentId: input.departmentId,
            isActive: true,
            isArchived: false,
        });
    });

    return input.id;
}
export function updateProject(id: string, patch: Partial<Omit<Project, "id">>) {
  updateDB((d) => {
    const p = d.projects.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}
export function archiveProject(id: string, archived: boolean) { updateProject(id, { isArchived: archived }); }
export function setProjectActive(id: string, active: boolean) { updateProject(id, { isActive: active }); }
export function deleteProject(id: string) {
  updateDB((d) => { d.projects = d.projects.filter((p) => p.id !== id); });
}
export function canManageProject(user: User, project?: Project | null): boolean {
  if (user.role === "admin") return true;
  if (user.role === "manager" && project && project.departmentId === user.departmentId) return true;
  return false;
}
export function canDeleteOrArchiveProject(user: User): boolean {
  return user.role === "admin";
}

// ---------- PREDEFINED ----------
export function listPredefined(activeOnly = true) {
  const all = getDB().predefined;
  return activeOnly ? all.filter((p) => !p.isArchived) : [...all];
}
export function upsertPredefined(p: Omit<PredefinedTask, "id"> & { id?: string }) {
  updateDB((d) => {
    if (p.id) {
      const i = d.predefined.findIndex((x) => x.id === p.id);
      if (i >= 0) d.predefined[i] = { ...d.predefined[i], ...p, id: p.id };
    } else {
      d.predefined.push({...p,id: p.id!,});
    }
  });
}
export function archivePredefined(id: string, archived: boolean) {
  updateDB((d) => {
    const p = d.predefined.find((x) => x.id === id);
    if (p) p.isArchived = archived;
  });
}
export function deletePredefined(id: string) {
  updateDB((d) => { d.predefined = d.predefined.filter((p) => p.id !== id); });
}
export function canManagePredefined(user: User, p?: PredefinedTask | null): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  if (!p) return true; // create
  const proj = projectById(p.projectId);
  return !!proj && proj.departmentId === user.departmentId;
}
export function canDeleteOrArchivePredefined(user: User): boolean {
  return user.role === "admin";
}

// ---------- NOTIFICATIONS helpers ----------
function notify(userId: string, type: any, taskId: string, message: string) {
  updateDB((d) => {
    d.notifications.push({
      id: uid("n"), userId, type, taskId, message, read: false,
      createdAt: new Date().toISOString(),
    });
  });
}

// ---------- ATTACHMENT VALIDATION ----------
const ALLOWED_EXT = new Set([
  "pdf","docx","xlsx","pptx","txt","csv",
  "jpg","jpeg","png","gif","webp",
  "mp4","mov","avi",
  "mp3","wav",
  "zip",
]);
const BLOCKED_EXT = new Set([
  "exe","bat","sh","js","py","rb","php","cmd","vbs","msi","dmg","app","rar","tar",
]);
export function isFileAllowed(fileName: string): { ok: boolean; error?: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXT.has(ext)) return { ok: false, error: `File type .${ext} is not permitted.` };
  if (!ALLOWED_EXT.has(ext)) return { ok: false, error: `File type .${ext} is not supported.` };
  return { ok: true };
}

// ---------- TASKS ----------
export function listTasks() { return [...getDB().tasks]; }
export function getTask(id: string) { return getDB().tasks.find((t) => t.id === id) ?? null; }

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId: string;
  priority: Priority;
  deadline: string;
  assigneeIds: string[];
  assignedBy?: string;
  comments?: string;
  attachments?: { fileName: string; dataUrl: string }[];
  taskType: TaskType;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceDayOfMonth?: number;
  weeklyDays?: string[];
  customRecurrenceDays?: number;
  reminders?: { description: string; remindAt: string }[];
  parentRecurrenceId?: string;
}

function buildAssignment(assigneeId: string, creator: User, initialComment?: string, initialAttachments?: { fileName: string; dataUrl: string }[]): TaskAssignment {
  const now = new Date().toISOString();
  return {
    id: uid("as"),
    assigneeId,
    status: "yet_to_start",
    comments: initialComment ? [{ id: uid("c"), userId: creator.id, body: initialComment, createdAt: now }] : [],
    attachments: (initialAttachments ?? []).map((a) => ({
      id: uid("at"), userId: creator.id, fileName: a.fileName, dataUrl: a.dataUrl, createdAt: now,
    })),
    activity: [{ id: uid("a"), userId: creator.id, action: "created", createdAt: now }],
    extensionRequests: [],
  };
}

export function createTask(input: CreateTaskInput, creator: User) {
  const id = uid("t");
  const now = new Date().toISOString();
  const project = projectById(input.projectId);
  const isSelfAssigned = input.assigneeIds.length === 1 && input.assigneeIds[0] === creator.id;
  const isRecurring = input.taskType === "recurring" || !!input.isRecurring;
  const task: Task = {
    id,
    title: input.title,
    description: input.description,
    projectId: input.projectId,
    department: project?.departmentId ? (departmentById(project.departmentId)?.name ?? creator.department) : creator.department,
    priority: input.priority,
    deadline: input.deadline,
    assignedBy: input.assignedBy,
    createdBy: creator.id,
    createdAt: now,
    updatedAt: now,
    assignments: input.assigneeIds.map((aid) => buildAssignment(aid, creator, input.comments, input.attachments)),
    reminders: (input.reminders ?? []).map((r) => ({ id: uid("rm"), description: r.description, remindAt: r.remindAt, notified: false })),
    taskType: input.taskType,
    isRecurring,
    recurrencePattern: isRecurring ? input.recurrencePattern : undefined,
    weeklyDays: isRecurring ? input.weeklyDays : undefined,
    customRecurrenceDays: isRecurring ? input.customRecurrenceDays : undefined,
    parentRecurrenceId: input.parentRecurrenceId,
    isSelfAssigned,
  };
  updateDB((d) => { d.tasks.push(task); });
  for (const aid of input.assigneeIds) {
    if (aid !== creator.id) notify(aid, "assigned", id, `New task: ${task.title}`);
  }
  return id;
}

function findAssignment(taskId: string, assignmentId: string) {
  const t = getTask(taskId);
  if (!t) return { task: null, assignment: null };
  const a = t.assignments.find((x) => x.id === assignmentId);
  return { task: t, assignment: a ?? null };
}

// Allowed transitions (assignee side + system).
function isAllowedTransition(prev: TaskStatus, next: TaskStatus): boolean {
  if (prev === "closed") return false;
  if (prev === next) return false;
  const map: Record<TaskStatus, TaskStatus[]> = {
    yet_to_start: ["in_progress"],
    in_progress: ["on_hold", "submitted_for_review", "closed"],
    on_hold: ["in_progress"],
    submitted_for_review: ["closed", "in_progress"], // in_progress only via sendBack (reviewer)
    closed: [],
  };
  return map[prev].includes(next);
}

export function updateAssignmentStatus(
  taskId: string,
  assignmentId: string,
  status: TaskStatus,
  actor: User,
  extra?: { onHoldReason?: string; reviewComments?: string; rating?: number },
): { ok: boolean; error?: string } {
  const { task, assignment } = findAssignment(taskId, assignmentId);
  if (!task || !assignment) return { ok: false, error: "Not found" };
  if (assignment.status === "closed") return { ok: false, error: "Task is closed and read-only" };
  if (!isAllowedTransition(assignment.status, status)) {
    return { ok: false, error: `Transition ${assignment.status} → ${status} is not permitted` };
  }

  const isAssignee = assignment.assigneeId === actor.id;
  const canReview = canReviewClose(actor, task, assignment);

  // Assignee cannot self-revert from submitted_for_review
  if (assignment.status === "submitted_for_review" && !canReview) {
    return { ok: false, error: "Only Manager/Team Lead can act on Submitted for Review" };
  }
  // Send-back path (submitted_for_review → in_progress) is not exposed here; use sendBack()
  if (assignment.status === "submitted_for_review" && status === "in_progress") {
    return { ok: false, error: "Use Send Back to return this task" };
  }

  if (status === "on_hold" && !extra?.onHoldReason?.trim()) return { ok: false, error: "On Hold requires a reason" };
  if (status === "closed" && !extra?.reviewComments?.trim()) return { ok: false, error: "Closing requires review comments" };

  // Submit for review: must have attachment
  if (status === "submitted_for_review" && assignment.attachments.length === 0) {
    return { ok: false, error: "Please upload at least one work attachment before submitting for review." };
  }

  // Closing rules — only reviewer can close from submitted_for_review (for assigned tasks).
  // Self-assigned tasks can close directly from in_progress (no review required for self)
  if (status === "closed") {
    if (assignment.status === "submitted_for_review" && !canReview) {
      return { ok: false, error: "Only the reviewer can close a task" };
    }
    if (assignment.status === "in_progress" && !task.isSelfAssigned) {
      return { ok: false, error: "Non-self-assigned tasks must be Submitted for Review before closing" };
    }
  }

  if (!isAssignee && !canReview) return { ok: false, error: "Not permitted" };

  const now = new Date().toISOString();
  const prev = assignment.status;
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a) return;
    a.status = status;
    if (status === "on_hold") {
      a.onHoldReason = extra?.onHoldReason;
      a.activity.push({
        id: uid("a"), userId: actor.id, action: "on_hold",
        details: `Reason: "${extra?.onHoldReason ?? ""}"`, createdAt: now,
      });
    } else if (status === "submitted_for_review") {
      a.submittedAt = now;
      a.activity.push({ id: uid("a"), userId: actor.id, action: "submitted_for_review", createdAt: now });
    } else if (status === "closed") {
      a.closedAt = now;
      a.closedBy = actor.id;
      a.reviewComments = extra?.reviewComments;
      const skipRating = !!task.isSelfAssigned;
      if (!skipRating && extra?.rating != null) a.rating = extra.rating;
      a.activity.push({
        id: uid("a"), userId: actor.id, action: "closed",
        details: extra?.reviewComments ? `Review: "${extra.reviewComments}"` : undefined,
        createdAt: now,
      });
    } else {
      a.activity.push({
        id: uid("a"), userId: actor.id, action: "status_changed",
        details: `${prev} → ${status}`, createdAt: now,
      });
    }
    t.updatedAt = now;
  });

  const updated = getTask(taskId);
  const upAssign = updated?.assignments.find((x) => x.id === assignmentId);
  if (updated && upAssign) {
    if (status === "submitted_for_review") {
      const recipients = new Set<string>([updated.createdBy]);
      getAncestors(getDB().users, upAssign.assigneeId).forEach((u) => recipients.add(u.id));
      recipients.delete(actor.id);
      recipients.forEach((uid) => notify(uid, "submitted_for_review", taskId, `"${updated.title}" submitted for review`));
    }
    if (status === "closed") {
      notify(upAssign.assigneeId, "closed", taskId, `Your task "${updated.title}" was closed`);
      if (updated.isRecurring && !updated.recurrenceDisabled && updated.assignments.every((a) => a.status === "closed")) {
        spawnNextRecurrence(updated, actor);
      }
    }
  }
  return { ok: true };
}

// Send Back — reviewer only, from submitted_for_review → in_progress. Requires comments.
// Not allowed for self-assigned tasks.
export function sendBack(taskId: string, assignmentId: string, comments: string, actor: User): { ok: boolean; error?: string } {
  const { task, assignment } = findAssignment(taskId, assignmentId);
  if (!task || !assignment) return { ok: false, error: "Not found" };
  if (task.isSelfAssigned) return { ok: false, error: "Send Back is not available for self-assigned tasks" };
  if (assignment.status !== "submitted_for_review") return { ok: false, error: "Only Submitted for Review can be sent back" };
  if (!canReviewClose(actor, task, assignment)) return { ok: false, error: "Only Manager/Team Lead can send back" };
  if (!comments.trim()) return { ok: false, error: "Send Back requires comments" };
  const now = new Date().toISOString();
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a) return;
    a.status = "in_progress";
    a.submittedAt = undefined; // reset 30-day timer
    a.activity.push({
      id: uid("a"), userId: actor.id, action: "sent_back",
      details: `Comments: "${comments.trim()}"`, createdAt: now,
    });
    t.updatedAt = now;
  });
  notify(assignment.assigneeId, "sent_back", taskId, `"${task.title}" was sent back for revision`);
  return { ok: true };
}

// Recurring "Mark as Completed" — assignee action. For assigned recurring: submits for review.
// For self-assigned recurring: closes immediately and spawns next instance.
export function markRecurringCompleted(taskId: string, assignmentId: string, actor: User): { ok: boolean; error?: string } {
  const { task, assignment } = findAssignment(taskId, assignmentId);
  if (!task || !assignment) return { ok: false, error: "Not found" };
  if (!task.isRecurring) return { ok: false, error: "Not a recurring task" };
  if (assignment.assigneeId !== actor.id) return { ok: false, error: "Only the assignee can mark as completed" };
  if (assignment.status === "closed") return { ok: false, error: "Task is closed" };
  if (assignment.status === "submitted_for_review") return { ok: false, error: "Already submitted for review" };
  if (assignment.attachments.length === 0) {
    return { ok: false, error: "Please upload at least one work attachment before submitting for review." };
  }

  if (task.isSelfAssigned) {
    const now = new Date().toISOString();
    updateDB((d) => {
      const t = d.tasks.find((x) => x.id === taskId);
      const a = t?.assignments.find((x) => x.id === assignmentId);
      if (!t || !a) return;
      a.status = "closed";
      a.closedAt = now;
      a.closedBy = actor.id;
      a.activity.push({ id: uid("a"), userId: actor.id, action: "mark_as_completed", createdAt: now });
      t.updatedAt = now;
    });
    const updated = getTask(taskId);
    notify(actor.id, "closed", taskId, `Recurring task "${task.title}" closed`);
    if (updated && !updated.recurrenceDisabled && updated.assignments.every((a) => a.status === "closed")) {
      spawnNextRecurrence(updated, actor);
    }
    return { ok: true };
  }

  // Assigned recurring: submit for review
  return updateAssignmentStatus(taskId, assignmentId, "submitted_for_review", actor);
}

function spawnNextRecurrence(task: Task, actor: User) {
  const days = task.recurrencePattern === "daily" ? 1
    : task.recurrencePattern === "weekly" ? 7
    : task.recurrencePattern === "monthly" ? 30
    : (task.customRecurrenceDays ?? 7);
  const base = new Date(task.deadline + "T00:00:00");
  base.setDate(base.getDate() + days);
  const nextDeadline = base.toISOString().slice(0, 10);
  createTask(
    {
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      priority: task.priority,
      deadline: nextDeadline,
      assigneeIds: task.assignments.map((a) => a.assigneeId),
      assignedBy: task.assignedBy,
      taskType: "recurring",
      isRecurring: true,
      recurrencePattern: task.recurrencePattern,
      customRecurrenceDays: task.customRecurrenceDays,
      parentRecurrenceId: task.parentRecurrenceId ?? task.id,
    },
    actor,
  );
}

export function setRecurrenceDisabled(taskId: string, disabled: boolean, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (!(actor.role === "manager" || actor.role === "team_lead")) return;
    t.recurrenceDisabled = disabled;
  });
}

export function addComment(taskId: string, assignmentId: string, body: string, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a || a.status === "closed") return;
    const now = new Date().toISOString();
    a.comments.push({ id: uid("c"), userId: actor.id, body, createdAt: now });
    a.activity.push({ id: uid("a"), userId: actor.id, action: "commented", createdAt: now });
    t.updatedAt = now;
  });
  const t = getTask(taskId);
  if (t) notify(t.createdBy === actor.id ? t.assignments.find((x) => x.id === assignmentId)?.assigneeId ?? t.createdBy : t.createdBy, "modified", taskId, `New comment on "${t.title}"`);
}

export function addAttachment(taskId: string, assignmentId: string, file: { fileName: string; dataUrl: string }, actor: User): { ok: boolean; error?: string } {
  const check = isFileAllowed(file.fileName);
  if (!check.ok) return check;
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a || a.status === "closed") return;
    const now = new Date().toISOString();
    a.attachments.push({ id: uid("at"), userId: actor.id, fileName: file.fileName, dataUrl: file.dataUrl, createdAt: now });
    a.activity.push({ id: uid("a"), userId: actor.id, action: "attached_file", details: file.fileName, createdAt: now });
    t.updatedAt = now;
  });
  return { ok: true };
}

export function editTask(taskId: string, patch: Partial<Pick<Task, "title" | "description" | "priority" | "deadline" | "projectId">>, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.assignments.every((a) => a.status === "closed")) return;
    Object.assign(t, patch);
    if (patch.projectId) {
      const proj = d.projects.find((p) => p.id === patch.projectId);
      if (proj) {
        const dep = d.departments.find((x) => x.id === proj.departmentId);
        if (dep) t.department = dep.name;
      }
    }
    t.updatedAt = new Date().toISOString();
  });
  const t = getTask(taskId);
  if (t) t.assignments.forEach((a) => notify(a.assigneeId, "modified", taskId, `Task "${t.title}" was updated`));
}

// ---------- EXTENSION REQUESTS ----------
export function requestExtension(taskId: string, assignmentId: string, reason: string, proposedDeadline: string, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a || a.status === "closed") return;
    const now = new Date().toISOString();
    a.extensionRequests.push({
      id: uid("er"), requestedBy: actor.id, reason, proposedDeadline, status: "pending", createdAt: now,
    });
    a.activity.push({
      id: uid("a"), userId: actor.id, action: "extension_requested",
      details: `Reason: "${reason}". Proposed deadline: ${proposedDeadline}`, createdAt: now,
    });
    t.updatedAt = now;
  });
  const t = getTask(taskId);
  if (t) {
    const recipients = new Set<string>([t.createdBy]);
    const a = t.assignments.find((x) => x.id === assignmentId);
    if (a) getAncestors(getDB().users, a.assigneeId).forEach((u) => recipients.add(u.id));
    recipients.delete(actor.id);
    recipients.forEach((uid) => notify(uid, "extension_requested", taskId, `Extension requested on "${t.title}"`));
  }
}

export function decideExtension(taskId: string, assignmentId: string, extensionId: string, decision: "accepted" | "rejected", comments: string, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    const er = a?.extensionRequests.find((x) => x.id === extensionId);
    if (!t || !a || !er) return;
    const now = new Date().toISOString();
    er.status = decision;
    er.decidedBy = actor.id;
    er.decisionComments = comments;
    er.decidedAt = now;
    if (decision === "accepted") t.deadline = er.proposedDeadline;
    a.activity.push({
      id: uid("a"), userId: actor.id, action: `extension_${decision}`,
      details: `Comments: "${comments}"`, createdAt: now,
    });
    t.updatedAt = now;
  });
  const t = getTask(taskId);
  const a = t?.assignments.find((x) => x.id === assignmentId);
  if (t && a) notify(a.assigneeId, decision === "accepted" ? "extension_accepted" : "extension_rejected", taskId, `Extension ${decision} on "${t.title}"`);
}

// ---------- REMINDERS ----------
export function addReminder(taskId: string, description: string, remindAt: string) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.reminders.push({ id: uid("rm"), description, remindAt, notified: false });
  });
}
export function deleteReminder(taskId: string, reminderId: string) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.reminders = t.reminders.filter((r) => r.id !== reminderId);
  });
}

// ---------- DUE + REMINDER + AUTO-CLOSE SCANNER ----------
export function runDueChecks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifs: { userId: string; type: any; taskId: string; message: string }[] = [];
  const autoClosedTasks: string[] = [];

  updateDB((d) => {
    for (const t of d.tasks) {
      for (const r of t.reminders) {
        if (!r.notified && new Date(r.remindAt + "T00:00:00") <= today) {
          r.notified = true;
          for (const a of t.assignments) {
            if (a.status !== "closed") {
              notifs.push({ userId: a.assigneeId, type: "reminder", taskId: t.id, message: `Reminder: ${r.description} (${t.title})` });
            }
          }
        }
      }
      const dl = new Date(t.deadline + "T00:00:00");
      const diffDays = Math.round((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      for (const a of t.assignments) {
        if (a.status === "closed") continue;
        // Auto-close self-assigned tasks stuck in Submitted for Review > 30 days
        if (t.isSelfAssigned && a.status === "submitted_for_review" && a.submittedAt) {
          const days = Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 30) {
            const nowIso = new Date().toISOString();
            a.status = "closed";
            a.closedAt = nowIso;
            a.activity.push({
              id: uid("a"), userId: a.assigneeId, action: "auto_closed",
              details: "Task auto-closed by system after 30 days in Submitted for Review status.",
              createdAt: nowIso,
            });
            notifs.push({ userId: a.assigneeId, type: "auto_closed", taskId: t.id, message: `"${t.title}" was auto-closed after 30 days.` });
            autoClosedTasks.push(t.id);
            continue;
          }
        }
        if (diffDays <= 3 && diffDays > 1 && !a.notified72h) {
          a.notified72h = true;
          notifs.push({ userId: a.assigneeId, type: "due_72h", taskId: t.id, message: `Due in 72 hours: "${t.title}"` });
        }
        if (diffDays === 1 && !a.notifiedTomorrow) {
          a.notifiedTomorrow = true;
          notifs.push({ userId: a.assigneeId, type: "due_tomorrow", taskId: t.id, message: `Due tomorrow: "${t.title}"` });
        }
        if (diffDays === 0 && !a.notifiedToday) {
          a.notifiedToday = true;
          notifs.push({ userId: a.assigneeId, type: "due_today", taskId: t.id, message: `Due today: "${t.title}"` });
        }
      }
    }
  });
  for (const n of notifs) notify(n.userId, n.type, n.taskId, n.message);
  // Recurrence spawn for auto-closed
  const currentUser = getCurrentUser();
  if (currentUser) {
    for (const tid of autoClosedTasks) {
      const t = getTask(tid);
      if (t && t.isRecurring && !t.recurrenceDisabled && t.assignments.every((a) => a.status === "closed")) {
        spawnNextRecurrence(t, currentUser);
      }
    }
  }
}

// ---------- VISIBILITY ----------
export function canSeeTask(user: User, task: Task): boolean {
  if (user.role === "admin") return false;
  if (task.createdBy === user.id) return true;
  if (task.assignments.some((a) => a.assigneeId === user.id)) return true;
  const descendants = getDescendants(getDB().users, user.id).map((u) => u.id);
  return task.assignments.some((a) => descendants.includes(a.assigneeId));
}
export function tasksFor(user: User): Task[] { return listTasks().filter((t) => canSeeTask(user, t)); }
export function myAssignments(user: User): { task: Task; assignment: TaskAssignment }[] {
  const out: { task: Task; assignment: TaskAssignment }[] = [];
  for (const t of listTasks()) for (const a of t.assignments) if (a.assigneeId === user.id) out.push({ task: t, assignment: a });
  return out;
}
export function teamAssignments(user: User): { task: Task; assignment: TaskAssignment }[] {
  const desc = getDescendants(getDB().users, user.id).map((u) => u.id);
  const out: { task: Task; assignment: TaskAssignment }[] = [];
  for (const t of listTasks()) for (const a of t.assignments) {
    if (desc.includes(a.assigneeId) || t.createdBy === user.id) out.push({ task: t, assignment: a });
  }
  return out;
}
export function pendingReviewsFor(user: User) {
  return teamAssignments(user).filter(({ task, assignment }) => assignment.status === "submitted_for_review" && canReviewClose(user, task, assignment));
}
export function pendingExtensionsFor(user: User) {
  const out: { task: Task; assignment: TaskAssignment; extensionId: string }[] = [];
  for (const { task, assignment } of teamAssignments(user)) {
    for (const er of assignment.extensionRequests) {
      if (er.status === "pending" && canReviewClose(user, task, assignment)) {
        out.push({ task, assignment, extensionId: er.id });
      }
    }
  }
  return out;
}

// eligible assignees — descendants only (name search)
export function eligibleAssignees(user: User, query = "", includeSelf = false): User[] {
  let list = getDescendants(getDB().users, user.id).filter((u) => u.isActive && u.role !== "manager");
  if (includeSelf) list = [user, ...list];
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((u) => u.fullName.toLowerCase().includes(q));
}

export function canReviewClose(user: User, _task: Task | undefined, assignment: TaskAssignment): boolean {
  if (user.role === "reportee") return false;
  if (assignment.assigneeId === user.id) return user.role === "manager";
  const ancestors = getAncestors(getDB().users, assignment.assigneeId).map((u) => u.id);
  return ancestors.includes(user.id);
}

// ---------- NOTIFICATIONS ----------
export function listNotifications(userId: string) {
  return getDB().notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function markNotificationRead(id: string) {
  updateDB((d) => { const n = d.notifications.find((x) => x.id === id); if (n) n.read = true; });
}
export function markAllRead(userId: string) {
  updateDB((d) => { d.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true)); });
}
export function rolesAvailable(): Role[] { return ["admin", "manager", "team_lead", "reportee"]; }

export function assignedByOptions(user: User): User[] {
  const users = getDB().users;
  const byId = (id: string | null | undefined) => (id ? users.find((u) => u.id === id) ?? null : null);
  if (user.role === "manager") return [];
  if (user.role === "team_lead") {
    const mgr = byId(user.managerId);
    return mgr ? [mgr] : [];
  }
  if (user.role === "reportee") {
    const out: User[] = [];
    const direct = byId(user.managerId);
    if (direct) out.push(direct);
    if (direct?.managerId) {
      const grand = byId(direct.managerId);
      if (grand) out.push(grand);
    }
    return out;
  }
  return [];
}
