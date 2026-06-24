export type Role = "admin" | "manager" | "team_lead" | "reportee";

export type Priority = "high" | "medium" | "low";
export type TaskStatus = "not_started" | "in_progress" | "on_hold" | "completed";

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  password: string; // mock only
  role: Role;
  department: string;
  managerId: string | null;
  isActive: boolean;
}

export interface PredefinedTask {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  defaultPriority: Priority;
  department: string;
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

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
  department: string;
  comments: Comment[];
  attachments: Attachment[];
  activity: ActivityEntry[];
  assigneeIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  rating?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: "assigned" | "updated" | "overdue" | "completed" | "rated";
  taskId: string;
  message: string;
  read: boolean;
  createdAt: string;
}
