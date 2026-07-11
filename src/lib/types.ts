export type Role = "admin" | "manager" | "team_lead" | "reportee";

export type Priority = "high" | "medium" | "low";
export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "submitted_for_review"
  | "closed";

export type RecurrencePattern = "daily" | "weekly" | "monthly" | "custom";

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  departmentId: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  password: string;
  role: Role;
  department: string; // department name (kept as string for backward compat with hierarchy)
  departmentId?: string;
  managerId: string | null;
  isActive: boolean;
}

export interface PredefinedTask {
  id: string;
  title: string;
  projectId: string;
  defaultPriority: Priority;
  defaultComments?: string;
  isArchived: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  userId: string;
  fileName: string;
  dataUrl: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  action: string;
  details?: string;
  createdAt: string;
}

export interface ExtensionRequest {
  id: string;
  requestedBy: string;
  reason: string;
  proposedDeadline: string; // YYYY-MM-DD
  status: "pending" | "accepted" | "rejected";
  decidedBy?: string;
  decisionComments?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface TaskAssignment {
  id: string;
  assigneeId: string;
  status: TaskStatus;
  onHoldReason?: string;
  reviewComments?: string;
  rating?: number;
  submittedAt?: string;
  closedAt?: string;
  closedBy?: string;
  comments: Comment[];
  attachments: Attachment[];
  activity: ActivityEntry[];
  extensionRequests: ExtensionRequest[];
  // deadline-reminder tracking (per assignment)
  notified72h?: boolean;
  notifiedTomorrow?: boolean;
  notifiedToday?: boolean;
}

export interface ReminderItem {
  id: string;
  description: string;
  remindAt: string; // YYYY-MM-DD
  notified: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  department: string; // derived from project's department
  priority: Priority;
  deadline: string; // YYYY-MM-DD (date only)
  assignedBy?: string; // for self-assign flows
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignments: TaskAssignment[];
  reminders: ReminderItem[];
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  customRecurrenceDays?: number;
  parentRecurrenceId?: string;
  isSelfAssignedManager?: boolean; // convenience flag
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | "assigned"
    | "modified"
    | "submitted_for_review"
    | "closed"
    | "extension_requested"
    | "extension_accepted"
    | "extension_rejected"
    | "reminder"
    | "due_72h"
    | "due_tomorrow"
    | "due_today";
  taskId: string;
  message: string;
  read: boolean;
  createdAt: string;
}
