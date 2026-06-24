import type {
  User,
  PredefinedTask,
  Task,
  Notification,
} from "./types";

const KEY = "tms_db_v1";

export interface DB {
  users: User[];
  predefined: PredefinedTask[];
  tasks: Task[];
  notifications: Notification[];
  currentUserId: string | null;
}

const seed = (): DB => ({
  currentUserId: null,
  users: [
    {
      id: "u_admin",
      employeeId: "E001",
      fullName: "Ada Admin",
      email: "admin@demo.com",
      password: "demo",
      role: "admin",
      department: "Operations",
      managerId: null,
      isActive: true,
    },
    {
      id: "u_mgr",
      employeeId: "E002",
      fullName: "Maya Manager",
      email: "manager@demo.com",
      password: "demo",
      role: "manager",
      department: "Engineering",
      managerId: null,
      isActive: true,
    },
    {
      id: "u_lead",
      employeeId: "E003",
      fullName: "Leo Lead",
      email: "lead@demo.com",
      password: "demo",
      role: "team_lead",
      department: "Engineering",
      managerId: "u_mgr",
      isActive: true,
    },
    {
      id: "u_rep1",
      employeeId: "E004",
      fullName: "Riya Reportee",
      email: "riya@demo.com",
      password: "demo",
      role: "reportee",
      department: "Engineering",
      managerId: "u_lead",
      isActive: true,
    },
    {
      id: "u_rep2",
      employeeId: "E005",
      fullName: "Ravi Reportee",
      email: "ravi@demo.com",
      password: "demo",
      role: "reportee",
      department: "Engineering",
      managerId: "u_lead",
      isActive: true,
    },
    {
      id: "u_rep3",
      employeeId: "E006",
      fullName: "Nina Reportee",
      email: "nina@demo.com",
      password: "demo",
      role: "reportee",
      department: "Engineering",
      managerId: "u_mgr",
      isActive: true,
    },
  ],
  predefined: [
    {
      id: "p1",
      title: "Code Review",
      category: "Development",
      subCategory: "Quality",
      defaultPriority: "medium",
      department: "Engineering",
      defaultComments: "Review the PR and leave inline feedback.",
      isArchived: false,
    },
    {
      id: "p2",
      title: "Sprint Planning",
      category: "Process",
      subCategory: "Planning",
      defaultPriority: "high",
      department: "Engineering",
      isArchived: false,
    },
    {
      id: "p3",
      title: "Production Bug Fix",
      category: "Development",
      subCategory: "Hotfix",
      defaultPriority: "high",
      department: "Engineering",
      isArchived: false,
    },
    {
      id: "p4",
      title: "Customer Outreach",
      category: "Sales",
      defaultPriority: "medium",
      department: "Sales",
      isArchived: false,
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Fix login flow regression",
      description: "Users report 500 after OAuth callback.",
      category: "Development",
      subCategory: "Hotfix",
      priority: "high",
      status: "in_progress",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      department: "Engineering",
      comments: [],
      attachments: [],
      activity: [
        {
          id: "a1",
          userId: "u_mgr",
          action: "created",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ],
      assigneeIds: ["u_rep1"],
      createdBy: "u_mgr",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "t2",
      title: "Draft Q3 roadmap",
      category: "Process",
      priority: "medium",
      status: "not_started",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      department: "Engineering",
      comments: [],
      attachments: [],
      activity: [
        {
          id: "a2",
          userId: "u_mgr",
          action: "created",
          createdAt: new Date().toISOString(),
        },
      ],
      assigneeIds: ["u_lead"],
      createdBy: "u_mgr",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "t3",
      title: "Refactor billing module",
      category: "Development",
      priority: "low",
      status: "completed",
      deadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      department: "Engineering",
      comments: [],
      attachments: [],
      activity: [
        {
          id: "a3",
          userId: "u_lead",
          action: "created",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        },
      ],
      assigneeIds: ["u_rep2"],
      createdBy: "u_lead",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    {
      id: "t4",
      title: "Investigate flaky tests",
      category: "Development",
      priority: "medium",
      status: "on_hold",
      deadline: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      department: "Engineering",
      comments: [],
      attachments: [],
      activity: [
        {
          id: "a4",
          userId: "u_lead",
          action: "created",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
      ],
      assigneeIds: ["u_rep1", "u_rep2"],
      createdBy: "u_lead",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notifications: [],
});

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
  return () => listeners.delete(fn);
}

export function resetDB() {
  cache = seed();
  persist();
  listeners.forEach((l) => l());
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
