
# Task Management — Major Feature Update

Large, cross-cutting change to the existing frontend-only app (localStorage mock DB). Plan is grouped by layer so you can review scope before I touch code.

## 1. Data model (src/lib/types.ts + mock-db.ts)

New entities:
- `Department { id, name, isActive }`
- `Project { id, name, departmentId, isActive, isArchived }`
- `ReminderItem { id, taskId, description, remindAt, notified }`
- `ExtensionRequest { id, taskAssignmentId, requestedBy, reason, proposedDeadline, status: pending|accepted|rejected, decidedBy?, decisionComments?, createdAt, decidedAt? }`

Changed entities:
- `Task` — remove `category`, `subCategory`, `status`, `assigneeIds`, `comments`, `attachments`, `activity`, `rating`, `completedAt`. Add `projectId`, `assignedBy` (nullable), `isRecurring`, `recurrencePattern?: 'daily'|'weekly'|'monthly'|'custom'`, `customRecurrenceDays?`, `parentRecurrenceId?`. `deadline` becomes date-only string (`YYYY-MM-DD`). `department` derived from project.
- New `TaskAssignment { id, taskId, assigneeId, status: not_started|in_progress|on_hold|submitted_for_review|closed, onHoldReason?, reviewComments?, rating?, comments[], attachments[], activity[], submittedAt?, closedAt?, closedBy? }` — this is what makes each assignee independent.
- `PredefinedTask` — remove `category`/`subCategory`/`department`, add `projectId`.
- Statuses: `Not Started → In Progress → On Hold → Submitted for Review → Closed`. Remove `completed`.
- Notification types extended: `submitted_for_review`, `closed`, `extension_requested`, `extension_accepted`, `extension_rejected`, `reminder`, `due_72h`, `due_tomorrow`, `due_today`, `modified`.

Seed data updated: add `Departments` (Engineering, Sales, Operations), `Projects` (2–3 per dept), migrate existing sample tasks to reference a project, split existing multi-assignee tasks into per-assignee assignments.

## 2. API layer (src/lib/api.ts split into folder)

- `departments.ts` — list/create/update/deactivate. Delete blocked if any active project or task references it.
- `projects.ts` — list (filter by dept/active), create, edit, archive/deactivate; delete admin-only. Manager scoped to their own department for create/edit; no delete/archive.
- `predefined.ts` — CRUD with `projectId` (drops category/dept fields).
- `tasks.ts`:
  - `createTask()` now fans out one `TaskAssignment` per assignee; supports self-assign, `assignedBy`, recurrence, reminders.
  - `updateAssignmentStatus(assignmentId, next, { onHoldReason?, reviewComments?, rating? })` — enforces required fields per transition; blocks any write when `status === 'closed'`.
  - Auto-creates next recurrence instance when an assignment closes AND parent task `isRecurring` AND all sibling assignments closed.
  - `requestExtension`, `decideExtension`.
  - `addReminder`, `deleteReminder`.
  - Rating: recorded on assignment at closure; skipped when task is a self-assigned Manager task.
- `notifications.ts` — new event helpers; a lightweight `runDueChecks()` invoked on app load + on route focus scans assignments and reminders to emit `due_72h`/`due_tomorrow`/`due_today`/`reminder` once each.
- Permission helpers: `canReviewClose(user, assignment)`, `canRate(user, assignment)`, `canManageProject(user, project)`, `canDeleteProject(user)`.

## 3. UI — routes & components

New / updated routes:
- `/admin/departments` — CRUD + deactivate.
- `/admin/projects` — CRUD, archive, filter by department.
- `/admin/predefined` — rework: project selector replaces category/department.
- `/manager/projects` (reuse `/projects`) — manager-scoped create/edit within their dept.
- `/tasks/new` wizard:
  - Read-only `Department` chip from current user profile.
  - `Project` dropdown filtered by that department + active only. Positioned before Title.
  - Predefined-task mode auto-fills project/title/priority/comments (project editable within same dept).
  - Self-assign toggle. `Assigned By` dropdown behaves per role (hidden for Manager self-assign; TL sees only their manager; Reportee sees manager + TL).
  - Recurring toggle → pattern dropdown.
  - Reminder items editor (list + add).
  - Deadline = date picker only (no time).
- `/tasks/$id` — renders **per-assignment** panels (tabs when multiple assignees). Each panel owns its own status control, comments, attachments, activity, review comments, rating, and extension-request UI. Closed panels are fully read-only.
- Dashboard (Manager/TL):
  - Task cards show assignee avatar/name chip.
  - Filter by employee.
  - "Pending Reviews" list (all `submitted_for_review` assignments in scope).
  - "Pending Extension Requests" list with Accept/Reject inline.

New components:
- `ProjectPicker`, `DepartmentBadge` (read-only), `ReminderList`, `RecurrenceField`, `ExtensionRequestDialog`, `ExtensionDecisionCard`, `ReviewCloseDialog` (captures mandatory review comments + rating), `AssignmentPanel` (per-assignee task view), `AssigneeChip`, `PendingReviewsList`, `PendingExtensionsList`.

## 4. Business rules enforced

- Department field never editable outside `/admin/departments`; always read from `user.department`.
- Manager excluded from being an assignee (existing) but can now self-assign via the new toggle.
- Rating step skipped when closing a self-assigned Manager task.
- Closed assignments block all writes at API level (defensive) and hide edit affordances in UI.
- On Hold requires reason; Closed requires review comments; both enforced in dialogs.
- Recurrence: next instance cloned with new deadline (`+1 day/week/month/customDays`), fresh assignments, activity reset, `parentRecurrenceId` chained.

## 5. Notifications

Trigger points added in `tasks.ts`/`api.ts` for: assigned, modified, submitted_for_review (to creator + ancestors), closed (to assignee), extension_requested (to reviewer), extension_accepted/rejected (to assignee), reminder (on remindAt), due_72h/due_tomorrow/due_today (per assignment, once each — tracked via flags on the assignment). "Task Completed" removed.

## Out of scope

Real email delivery, backend/DB migration, mobile push, calendar integration. Custom recurrence editor limited to "every N days" input.

## Delivery

Given the breadth, I'll ship in one pass but touching many files: types, mock-db (with a versioned reseed since the schema is incompatible), api layer, all admin routes, task new/detail routes, dashboard, sidebar links, and the new components. Existing seed data resets on first load (bumped storage key) — acceptable for a mock-DB demo.
