import { getDB, updateDB, uid } from "./mock-db";
import type {
  Task,
  TaskAssignment,
  TaskStatus,
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
  updateDB((d) => {
    d.currentUserId = user.id;
  });
  return user;
}

export function logout() {
  updateDB((d) => {
    d.currentUserId = null;
  });
}

export function getCurrentUser(): User | null {
  const db = getDB();
  if (!db.currentUserId) return null;
  return db.users.find((u) => u.id === db.currentUserId) ?? null;
}

// ---------- USERS ----------
export function listUsers() {
  return [...getDB().users];
}
export function createUser(data: Omit<User, "id">) {
  const id = uid("u");
  updateDB((d) => {
    d.users.push({ ...data, id });
  });
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
export function createDepartment(name: string) {
  const id = uid("d");
  updateDB((d) => { d.departments.push({ id, name, isActive: true }); });
  return id;
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
export function createProject(input: { name: string; departmentId: string }) {
  const id = uid("pr");
  updateDB((d) => {
    d.projects.push({ id, name: input.name, departmentId: input.departmentId, isActive: true, isArchived: false });
  });
  return id;
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
  updateDB((d) => {
    d.projects = d.projects.filter((p) => p.id !== id);
  });
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
      d.predefined.push({ ...p, id: uid("p") });
    }
  });
}
export function archivePredefined(id: string, archived: boolean) {
  updateDB((d) => {
    const p = d.predefined.find((x) => x.id === id);
    if (p) p.isArchived = archived;
  });
}

// ---------- NOTIFICATIONS helpers ----------
function notify(userId: string, type: any, taskId: string, message: string) {
  updateDB((d) => {
    d.notifications.push({
      id: uid("n"),
      userId,
      type,
      taskId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
}

// ---------- TASKS ----------
export function listTasks() { return [...getDB().tasks]; }
export function getTask(id: string) { return getDB().tasks.find((t) => t.id === id) ?? null; }

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId: string;
  priority: Priority;
  deadline: string; // YYYY-MM-DD
  assigneeIds: string[];
  assignedBy?: string;
  comments?: string;
  attachments?: { fileName: string; dataUrl: string }[];
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  customRecurrenceDays?: number;
  reminders?: { description: string; remindAt: string }[];
}

function buildAssignment(assigneeId: string, creator: User, initialComment?: string, initialAttachments?: { fileName: string; dataUrl: string }[]): TaskAssignment {
  const now = new Date().toISOString();
  return {
    id: uid("as"),
    assigneeId,
    status: "not_started",
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
  const isSelfAssignedManager = creator.role === "manager" && input.assigneeIds.length === 1 && input.assigneeIds[0] === creator.id;
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
    isRecurring: input.isRecurring,
    recurrencePattern: input.recurrencePattern,
    customRecurrenceDays: input.customRecurrenceDays,
    isSelfAssignedManager,
  };
  updateDB((d) => { d.tasks.push(task); });
  for (const aid of input.assigneeIds) {
    if (aid !== creator.id) notify(aid, "assigned", id, `New task: ${task.title}`);
  }
  return id;
}

// helper for finding assignment
function findAssignment(taskId: string, assignmentId: string) {
  const t = getTask(taskId);
  if (!t) return { task: null, assignment: null };
  const a = t.assignments.find((x) => x.id === assignmentId);
  return { task: t, assignment: a ?? null };
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

  if (status === "on_hold" && !extra?.onHoldReason?.trim()) return { ok: false, error: "On Hold requires a reason" };
  if (status === "closed" && !extra?.reviewComments?.trim()) return { ok: false, error: "Closing requires review comments" };

  const canReview = canReviewClose(actor, task, assignment);
  if (status === "closed" && !canReview) return { ok: false, error: "Only the reviewer can close a task" };
  const isAssignee = assignment.assigneeId === actor.id;
  if (!isAssignee && !canReview) return { ok: false, error: "Not permitted" };

  const now = new Date().toISOString();
  const prev = assignment.status;
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a) return;
    a.status = status;
    if (status === "on_hold") a.onHoldReason = extra?.onHoldReason;
    if (status === "submitted_for_review") a.submittedAt = now;
    if (status === "closed") {
      a.closedAt = now;
      a.closedBy = actor.id;
      a.reviewComments = extra?.reviewComments;
      if (extra?.rating != null && !(t.isSelfAssignedManager && a.assigneeId === t.createdBy)) {
        a.rating = extra.rating;
      }
    }
    a.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "status_changed",
      details: `${prev} → ${status}`,
      createdAt: now,
    });
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
      // recurrence: create next instance when ALL assignments are closed
      if (updated.isRecurring && updated.assignments.every((a) => a.status === "closed")) {
        spawnNextRecurrence(updated, actor);
      }
    }
  }
  return { ok: true };
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
      isRecurring: true,
      recurrencePattern: task.recurrencePattern,
      customRecurrenceDays: task.customRecurrenceDays,
    },
    actor,
  );
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

export function addAttachment(taskId: string, assignmentId: string, file: { fileName: string; dataUrl: string }, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const a = t?.assignments.find((x) => x.id === assignmentId);
    if (!t || !a || a.status === "closed") return;
    const now = new Date().toISOString();
    a.attachments.push({ id: uid("at"), userId: actor.id, fileName: file.fileName, dataUrl: file.dataUrl, createdAt: now });
    a.activity.push({ id: uid("a"), userId: actor.id, action: "attached_file", details: file.fileName, createdAt: now });
    t.updatedAt = now;
  });
}

export function editTask(taskId: string, patch: Partial<Pick<Task, "title" | "description" | "priority" | "deadline" | "projectId">>, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    // block if all assignments closed
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
    a.activity.push({ id: uid("a"), userId: actor.id, action: "extension_requested", details: `Proposed ${proposedDeadline}`, createdAt: now });
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
    a.activity.push({ id: uid("a"), userId: actor.id, action: `extension_${decision}`, details: comments, createdAt: now });
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

// ---------- DUE-DATE + REMINDER SCANNER ----------
export function runDueChecks() {
  const db = getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifs: { userId: string; type: any; taskId: string; message: string }[] = [];

  updateDB((d) => {
    for (const t of d.tasks) {
      // reminder items
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
      // deadline reminders per assignment
      const dl = new Date(t.deadline + "T00:00:00");
      const diffDays = Math.round((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      for (const a of t.assignments) {
        if (a.status === "closed") continue;
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
}

// ---------- VISIBILITY ----------
export function canSeeTask(user: User, task: Task): boolean {
  if (user.role === "admin") return false;
  if (task.createdBy === user.id) return true;
  if (task.assignments.some((a) => a.assigneeId === user.id)) return true;
  const descendants = getDescendants(getDB().users, user.id).map((u) => u.id);
  return task.assignments.some((a) => descendants.includes(a.assigneeId));
}
export function tasksFor(user: User): Task[] {
  return listTasks().filter((t) => canSeeTask(user, t));
}
export function myAssignments(user: User): { task: Task; assignment: TaskAssignment }[] {
  const out: { task: Task; assignment: TaskAssignment }[] = [];
  for (const t of listTasks()) {
    for (const a of t.assignments) {
      if (a.assigneeId === user.id) out.push({ task: t, assignment: a });
    }
  }
  return out;
}
export function teamAssignments(user: User): { task: Task; assignment: TaskAssignment }[] {
  const desc = getDescendants(getDB().users, user.id).map((u) => u.id);
  const out: { task: Task; assignment: TaskAssignment }[] = [];
  for (const t of listTasks()) {
    for (const a of t.assignments) {
      if (desc.includes(a.assigneeId) || t.createdBy === user.id) out.push({ task: t, assignment: a });
    }
  }
  return out;
}
export function pendingReviewsFor(user: User) {
  return teamAssignments(user).filter(({ assignment }) => assignment.status === "submitted_for_review" && canReviewClose(user, undefined as any, assignment));
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

// eligible assignees (for creating tasks) — descendants; exclude managers as assignees except self
export function eligibleAssignees(user: User, query = "", includeSelf = false): User[] {
  let list = getDescendants(getDB().users, user.id).filter((u) => u.isActive && u.role !== "manager");
  if (includeSelf) list = [user, ...list];
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((u) => u.fullName.toLowerCase().includes(q) || u.employeeId.toLowerCase().includes(q));
}

// Reviewer/closer: task creator or an ancestor of the assignee (manager/team lead in hierarchy). Never the assignee themself (unless self-assigned manager).
export function canReviewClose(user: User, _task: Task | undefined, assignment: TaskAssignment): boolean {
  if (user.role === "reportee") return false;
  if (assignment.assigneeId === user.id) {
    // self-assigned manager can close their own task (rating skipped)
    return user.role === "manager";
  }
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

// "Assigned By" dropdown options for self-assign
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
