# Task Management App — Frontend-Only Build Plan

Build the full UI and interaction layer with **mock in-memory data**. No Lovable Cloud, no backend. User will wire their own database later — all data access goes through a thin `src/lib/api/*` layer with typed functions so swapping to a real backend is a one-file change per resource.

## 1. Data Layer (mockable, swap-ready)

- `src/lib/types.ts` — `Role`, `User`, `PredefinedTask`, `Task`, `TaskStatus`, `Priority`, `Comment`, `Attachment`, `ActivityEntry`, `Notification`
- `src/lib/mock-db.ts` — in-memory store seeded with sample users (one of each role), predefined tasks, a few tasks. Persists to `localStorage` so refresh keeps state.
- `src/lib/api/` — `auth.ts`, `users.ts`, `tasks.ts`, `predefined.ts`, `notifications.ts`. Each exports async functions returning typed data. Today they read/write `mock-db`; later they call the real API.
- `src/lib/hierarchy.ts` — `getDescendants(userId)` traversal of `manager_id` tree.
- `src/lib/auth-context.tsx` — React context holding current user + role, persisted in `localStorage`.

## 2. Routes (TanStack Start)

- `/auth` — email + password login (mock: any seeded user, password `demo`)
- `/_authenticated/` — gate redirects to `/auth` if no session
  - `/dashboard` — role-aware; renders Admin / Manager / Team Lead / Reportee dashboard
  - `/admin/users` — create/edit/deactivate users, set manager (admin only)
  - `/admin/hierarchy` — tree visualizer/editor (admin only)
  - `/admin/predefined` — predefined task library CRUD (admin only)
  - `/tasks` — list with filters (status, priority, date), overdue + near-deadline highlights
  - `/tasks/new` — wizard: Predefined-vs-Manual → form → Summary → Confirm (manager/team_lead only)
  - `/tasks/$id` — detail: status update, comments, attachments (file → object URL), activity log, rating after Completed
  - `/team` — team overview + workload chart + drill-down by reportee (manager/team_lead)
  - `/notifications` — in-app notification list

## 3. Components

- App shell with sidebar nav (role-filtered links) + topbar with notifications bell
- `RoleGate`, `AssigneePicker` (search by name / employee ID, scoped to descendants, multi-select), `HierarchyTree`, `WorkloadChart` (recharts), `TaskCard`, `StatusBadge`, `PriorityBadge`, `ActivityLog`, `RatingStars`

## 4. Business Rules (enforced in UI + api layer)

- Admin cannot create/assign tasks
- Manager never receives tasks (excluded from assignee picker results when current user is manager? — kept assignable only when they are a descendant of another manager; per spec managers never receive, so picker excludes role=manager)
- Assignee picker results = descendants of current user only
- Reportee cannot assign tasks
- Rating only by task creator or any ancestor of assignee; only after status = Completed
- Every mutation appends an `ActivityEntry` and fires a `Notification` to relevant users
- Overdue = `deadline < now` AND status ≠ completed; near-deadline = within 24h

## 5. Design

Clean professional productivity aesthetic. Neutral slate base + single teal accent. Semantic tokens for status colors (not-started / in-progress / on-hold / completed) and priority (high/med/low) in `src/styles.css`. Generous spacing, sidebar layout.

## 6. Seed Data

4 sample users covering all roles in a small hierarchy, ~6 predefined tasks across 2 departments, ~5 sample tasks in varied states so dashboards look populated immediately.

---

Approve and I'll build it.