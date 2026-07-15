import type {
  User,
  PredefinedTask,
  Task,
  Notification,
  Department,
  Project,
} from "./types";

const KEY = "tms_db_v3";

export interface DB {
  departments: Department[];
  projects: Project[];
  users: User[];
  predefined: PredefinedTask[];
  tasks: Task[];
  notifications: Notification[];
  currentUserId: string | null;
}

const iso = (d: Date = new Date()) => d.toISOString();
const dateOnly = (d: Date = new Date()) => d.toISOString().slice(0, 10);
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const seed = (): DB => {
  const now = new Date();
  return {
    currentUserId: null,
    departments: [
      { id: "d_eng", name: "Engineering", isActive: true },
      { id: "d_ops", name: "Operations", isActive: true },
      { id: "d_sales", name: "Sales", isActive: true },
    ],
    projects: [
      { id: "pr_platform", name: "Platform Core", departmentId: "d_eng", isActive: true, isArchived: false },
      { id: "pr_mobile", name: "Mobile App", departmentId: "d_eng", isActive: true, isArchived: false },
      { id: "pr_ops", name: "Ops Automation", departmentId: "d_ops", isActive: true, isArchived: false },
      { id: "pr_sales", name: "Q3 Outreach", departmentId: "d_sales", isActive: true, isArchived: false },
    ],
    users: [
      { id: "u_admin", employeeId: "E001", fullName: "Ada Admin", email: "admin@demo.com", password: "demo", role: "admin", department: "Operations", departmentId: "d_ops", managerId: null, isActive: true },
      { id: "u_mgr", employeeId: "E002", fullName: "Maya Manager", email: "manager@demo.com", password: "demo", role: "manager", department: "Engineering", departmentId: "d_eng", managerId: null, isActive: true },
      { id: "u_lead", employeeId: "E003", fullName: "Leo Lead", email: "lead@demo.com", password: "demo", role: "team_lead", department: "Engineering", departmentId: "d_eng", managerId: "u_mgr", isActive: true },
      { id: "u_rep1", employeeId: "E004", fullName: "Riya Reportee", email: "riya@demo.com", password: "demo", role: "reportee", department: "Engineering", departmentId: "d_eng", managerId: "u_lead", isActive: true },
      { id: "u_rep2", employeeId: "E005", fullName: "Ravi Reportee", email: "ravi@demo.com", password: "demo", role: "reportee", department: "Engineering", departmentId: "d_eng", managerId: "u_lead", isActive: true },
      { id: "u_rep3", employeeId: "E006", fullName: "Nina Reportee", email: "nina@demo.com", password: "demo", role: "reportee", department: "Engineering", departmentId: "d_eng", managerId: "u_mgr", isActive: true },
    ],
    predefined: [
      { id: "p1", title: "Code Review", projectId: "pr_platform", defaultPriority: "medium", defaultComments: "Review the PR and leave inline feedback.", isArchived: false },
      { id: "p2", title: "Sprint Planning", projectId: "pr_platform", defaultPriority: "high", isArchived: false },
      { id: "p3", title: "Production Bug Fix", projectId: "pr_mobile", defaultPriority: "high", isArchived: false },
      { id: "p4", title: "Customer Outreach", projectId: "pr_sales", defaultPriority: "medium", isArchived: false },
    ],
    tasks: [
      {
        id: "t1",
        title: "Fix login flow regression",
        description: "Users report 500 after OAuth callback.",
        projectId: "pr_platform",
        department: "Engineering",
        priority: "high",
        deadline: dateOnly(addDays(now, 1)),
        createdBy: "u_mgr",
        createdAt: iso(addDays(now, -1)),
        updatedAt: iso(),
        taskType: "one_time",
        assignments: [
          {
            id: "as_t1_rep1",
            assigneeId: "u_rep1",
            status: "in_progress",
            comments: [],
            attachments: [],
            activity: [{ id: "a1", userId: "u_mgr", action: "created", createdAt: iso(addDays(now, -1)) }],
            extensionRequests: [],
          },
        ],
        reminders: [],
      },
      {
        id: "t2",
        title: "Draft Q3 roadmap",
        projectId: "pr_platform",
        department: "Engineering",
        priority: "medium",
        deadline: dateOnly(addDays(now, 5)),
        createdBy: "u_mgr",
        createdAt: iso(),
        updatedAt: iso(),
        taskType: "one_time",
        assignments: [
          {
            id: "as_t2_lead",
            assigneeId: "u_lead",
            status: "yet_to_start",
            comments: [],
            attachments: [],
            activity: [{ id: "a2", userId: "u_mgr", action: "created", createdAt: iso() }],
            extensionRequests: [],
          },
        ],
        reminders: [],
      },
      {
        id: "t3",
        title: "Investigate flaky tests",
        projectId: "pr_mobile",
        department: "Engineering",
        priority: "medium",
        deadline: dateOnly(addDays(now, -1)),
        createdBy: "u_lead",
        createdAt: iso(addDays(now, -3)),
        updatedAt: iso(),
        assignments: [
          {
            id: "as_t3_rep1",
            assigneeId: "u_rep1",
            status: "on_hold",
            onHoldReason: "Waiting on infra fix",
            comments: [],
            attachments: [],
            activity: [{ id: "a3", userId: "u_lead", action: "created", createdAt: iso(addDays(now, -3)) }],
            extensionRequests: [],
          },
          {
            id: "as_t3_rep2",
            assigneeId: "u_rep2",
            status: "submitted_for_review",
            comments: [],
            attachments: [],
            activity: [
              { id: "a4", userId: "u_lead", action: "created", createdAt: iso(addDays(now, -3)) },
              { id: "a5", userId: "u_rep2", action: "submitted_for_review", createdAt: iso() },
            ],
            extensionRequests: [],
            submittedAt: iso(),
          },
        ],
        reminders: [],
      },
    ],
    notifications: [],
  };
};

let cache: DB | null = null;
const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

export function getDB(): DB {
  if (cache) return cache;
  if (!isBrowser()) {
    cache = seed();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as DB;
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = seed();
  persist();
  return cache;
}

function persist() {
  if (!isBrowser() || !cache) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export function updateDB(mut: (db: DB) => void) {
  const db = getDB();
  mut(db);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function resetDB() {
  cache = seed();
  persist();
  listeners.forEach((l) => l());
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
