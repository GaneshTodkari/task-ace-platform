import { getDB, updateDB, uid } from "./mock-db";
import type {
  Task,
  TaskStatus,
  Priority,
  User,
  PredefinedTask,
  Role,
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

export function deactivateUser(id: string) {
  updateUser(id, { isActive: false });
}

export function activateUser(id: string) {
  updateUser(id, { isActive: true });
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

// ---------- TASKS ----------
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

export function listTasks() {
  return [...getDB().tasks];
}

export function getTask(id: string) {
  return getDB().tasks.find((t) => t.id === id) ?? null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  priority: Priority;
  deadline: string;
  department: string;
  assigneeIds: string[];
  comments?: string;
  attachments?: { fileName: string; dataUrl: string }[];
}

export function createTask(input: CreateTaskInput, creator: User) {
  const id = uid("t");
  const now = new Date().toISOString();
  const task: Task = {
    id,
    title: input.title,
    description: input.description,
    category: input.category,
    subCategory: input.subCategory,
    priority: input.priority,
    status: "not_started",
    deadline: input.deadline,
    department: input.department,
    comments: input.comments
      ? [{ id: uid("c"), userId: creator.id, body: input.comments, createdAt: now }]
      : [],
    attachments: (input.attachments ?? []).map((a) => ({
      id: uid("at"),
      userId: creator.id,
      fileName: a.fileName,
      dataUrl: a.dataUrl,
      createdAt: now,
    })),
    activity: [
      { id: uid("a"), userId: creator.id, action: "created", createdAt: now },
    ],
    assigneeIds: input.assigneeIds,
    createdBy: creator.id,
    createdAt: now,
    updatedAt: now,
  };
  updateDB((d) => {
    d.tasks.push(task);
  });
  for (const aid of input.assigneeIds) {
    notify(aid, "assigned", id, `New task: ${task.title}`);
  }
  return id;
}

export function updateTaskStatus(taskId: string, status: TaskStatus, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    const prev = t.status;
    t.status = status;
    t.updatedAt = new Date().toISOString();
    if (status === "completed") t.completedAt = t.updatedAt;
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "status_changed",
      details: `${prev} → ${status}`,
      createdAt: t.updatedAt,
    });
  });
  const t = getTask(taskId);
  if (t) {
    notify(t.createdBy, status === "completed" ? "completed" : "updated", taskId, `Task "${t.title}" → ${status}`);
  }
}

export function addComment(taskId: string, body: string, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    const now = new Date().toISOString();
    t.comments.push({ id: uid("c"), userId: actor.id, body, createdAt: now });
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "commented",
      createdAt: now,
    });
    t.updatedAt = now;
  });
}

export function addAttachment(
  taskId: string,
  file: { fileName: string; dataUrl: string },
  actor: User,
) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    const now = new Date().toISOString();
    t.attachments.push({
      id: uid("at"),
      userId: actor.id,
      fileName: file.fileName,
      dataUrl: file.dataUrl,
      createdAt: now,
    });
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "attached_file",
      details: file.fileName,
      createdAt: now,
    });
    t.updatedAt = now;
  });
}

export function reassignTask(taskId: string, assigneeIds: string[], actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    const now = new Date().toISOString();
    t.assigneeIds = assigneeIds;
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "reassigned",
      createdAt: now,
    });
    t.updatedAt = now;
  });
  for (const aid of assigneeIds) notify(aid, "assigned", taskId, `You were assigned a task`);
}

export function editTask(taskId: string, patch: Partial<Task>, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    Object.assign(t, patch);
    t.updatedAt = new Date().toISOString();
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "edited",
      createdAt: t.updatedAt,
    });
  });
}

export function rateTask(taskId: string, rating: number, actor: User) {
  updateDB((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.rating = rating;
    const now = new Date().toISOString();
    t.activity.push({
      id: uid("a"),
      userId: actor.id,
      action: "rated",
      details: `${rating}/5`,
      createdAt: now,
    });
    t.updatedAt = now;
  });
  const t = getTask(taskId);
  if (t) for (const aid of t.assigneeIds) notify(aid, "rated", taskId, `Rated ${rating}/5 on "${t.title}"`);
}

// ---------- VISIBILITY ----------
export function canSeeTask(user: User, task: Task): boolean {
  if (user.role === "admin") return false; // admin doesn't deal with tasks
  if (task.createdBy === user.id) return true;
  if (task.assigneeIds.includes(user.id)) return true;
  const descendants = getDescendants(getDB().users, user.id).map((u) => u.id);
  return task.assigneeIds.some((a) => descendants.includes(a));
}

export function tasksFor(user: User): Task[] {
  return listTasks().filter((t) => canSeeTask(user, t));
}

export function myTasks(user: User): Task[] {
  return listTasks().filter((t) => t.assigneeIds.includes(user.id));
}

export function teamTasks(user: User): Task[] {
  const descendants = getDescendants(getDB().users, user.id).map((u) => u.id);
  return listTasks().filter((t) =>
    t.assigneeIds.some((a) => descendants.includes(a)) || t.createdBy === user.id,
  );
}

export function eligibleAssignees(user: User, query = ""): User[] {
  const desc = getDescendants(getDB().users, user.id).filter((u) => u.isActive && u.role !== "manager");
  const q = query.trim().toLowerCase();
  if (!q) return desc;
  return desc.filter(
    (u) =>
      u.fullName.toLowerCase().includes(q) ||
      u.employeeId.toLowerCase().includes(q),
  );
}

export function canRate(user: User, task: Task): boolean {
  if (task.status !== "completed") return false;
  if (task.createdBy === user.id) return true;
  const users = getDB().users;
  return task.assigneeIds.some((aid) => getAncestors(users, aid).some((a) => a.id === user.id));
}

// ---------- NOTIFICATIONS ----------
export function listNotifications(userId: string) {
  return getDB().notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: string) {
  updateDB((d) => {
    const n = d.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}

export function markAllRead(userId: string) {
  updateDB((d) => {
    d.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
  });
}

export function rolesAvailable(): Role[] {
  return ["admin", "manager", "team_lead", "reportee"];
}
