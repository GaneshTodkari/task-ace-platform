# Routes

This project uses TanStack Router with file-based routing.

## Important Files

- `__root.tsx` – Root application layout
- `index.tsx` – Redirects to login or dashboard
- `auth.tsx` – Login page
- `dashboard.tsx` – Main dashboard
- `tasks/` – Task management pages
- `users/` – User management
- `departments/` – Department management
- `projects/` – Project management

## Notes

- Do not edit `routeTree.gen.ts`; it is generated automatically.
- All new pages should be created inside `src/routes`.
- Shared layouts should use layout routes (`_layout.tsx`) or `__root.tsx`.