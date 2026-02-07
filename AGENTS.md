# AGENTS.md

This file is an index for future agents working in this repository.
It tells you what to change, how to change it, and where related changes must go.

## 1) System Overview

- Runtime: Next.js App Router on Cloudflare Workers (OpenNext).
- Language: TypeScript (strict mode).
- API layer: tRPC (`src/server/trpc.ts`, `src/server/api/*`).
- Auth: Better Auth with Drizzle adapter (`src/server/auth.ts`).
- Database: Cloudflare D1 + Drizzle ORM (`src/server/db/schema.ts`, `drizzle/*`).
- Object storage: Cloudflare R2 (`src/lib/bucket.ts`, `src/app/api/upload/route.ts`).
- UI: React + Tailwind + shadcn-style components in `src/components`.

## 2) High-Signal Routing Table

Use this table first when deciding where to edit.

| Change type | Primary file(s) | Also update | Verify |
| --- | --- | --- | --- |
| Database schema/table/column | `src/server/db/schema.ts` | `drizzle/*` migrations, any repositories using changed fields, `src/types/better-auth.d.ts` for auth user fields | `bun run db:generate`, then migration command |
| Database query/business logic | `src/server/repositories/*.ts` | tRPC router procedures that call it (`src/server/api/routers/*.ts`) | Run relevant flows, then `bun run test:run` if utils touched |
| tRPC endpoint (new procedure/router) | `src/server/api/routers/*.ts` | Register router in `src/server/api/root.ts`; use guards from `src/server/trpc.ts` | Call from UI via `src/trpc/client.tsx` hooks |
| Auth behavior/session/user fields | `src/server/auth.ts` | `src/server/db/schema.ts`, `src/types/better-auth.d.ts`, auth UI in `src/components/auth/*` | Login/signup/admin actions |
| Server-side auth checks in pages/routes | `src/auth/server.ts` + target page/route | For admin-only paths, use `requireAdminAuth` | Manual page access check |
| REST-like route handlers | `src/app/api/**/route.ts` | Domain libs (`src/lib/*`), auth check via `getCurrentUser()` if needed | Hit endpoint locally |
| R2 upload/download logic | `src/lib/bucket.ts` | `src/app/api/upload/route.ts`, `src/app/api/files/[key]/route.ts`, constants in `src/lib/constants.ts` | Upload and fetch via `/api/files/:key` |
| Admin dashboard features | `src/app/admin/**` and `src/components/admin/**` | Navigation in `src/components/dashboard/app-sidebar.tsx`; tRPC calls in page components | Visit `/admin/*` paths |
| Add/modify navigation items | `src/components/dashboard/app-sidebar.tsx` | If route is new, add corresponding `src/app/.../page.tsx` | Manual nav click-through |
| App-wide layout/providers | `src/app/layout.tsx` | Theme/trpc provider integration (`src/components/theme-provider.tsx`, `src/trpc/client.tsx`) | Basic render + auth banner behavior |
| Env vars/schema validation | `src/env.mjs` | `.dev.vars` / deploy secrets, code using the env var | Build or run affected flows |
| Cloudflare bindings/workflows | `wrangler.json`, `worker.ts`, `src/server/workers/*.ts` | Bindings usage in server code and context (`src/server/trpc.ts`) | `bun run preview` for worker-ish behavior |
| Shared UI primitives | `src/components/ui/*` | Consumers in feature components | Visual/manual check |
| Utility helpers | `src/lib/utils.ts` | `src/lib/utils.test.ts` | `bun run test:run` |

## 3) Directory Map (What Lives Where)

- `src/app/`
  - Next.js App Router routes and route handlers.
  - Route groups:
    - `src/app/(authentication)` -> URL paths like `/login`, `/signup`.
    - `src/app/(dashboard)` -> URL paths like `/home`, `/home/upload`.
  - API handlers:
    - `src/app/api/auth/[...all]/route.ts` (Better Auth handler)
    - `src/app/api/trpc/[trpc]/route.ts` (tRPC adapter)
    - `src/app/api/upload/route.ts` + `src/app/api/files/[key]/route.ts` (R2)

- `src/server/`
  - Backend runtime code for DB/auth/tRPC.
  - `src/server/db/schema.ts` is the canonical DB schema.
  - `src/server/repositories/*` holds DB query + domain mutation logic.
  - `src/server/api/routers/*` exposes typed API procedures.
  - `src/server/trpc.ts` defines context and procedure guards (`protectedProcedure`, `adminProcedure`).

- `src/auth/`
  - Thin auth access layer:
    - `src/auth/client.ts` for client auth calls/hooks.
    - `src/auth/server.ts` for server auth helpers (`getCurrentUser`, `requireAuth`, `requireAdminAuth`).

- `src/trpc/`
  - Client/server tRPC wiring for React Query and RSC hydration.

- `src/components/`
  - Feature components (`admin`, `auth`, `dashboard`) and base `ui` components.

- `src/lib/`
  - Shared utility logic (`utils.ts`, `bucket.ts`, `constants.ts`, `admin.ts`).

- `src/models/errors/`
  - App error taxonomy. Reuse these in repositories and map them to tRPC errors in routers.

- `drizzle/`
  - SQL migrations and metadata snapshots.

- `scripts/`
  - Setup/ops scripts (`first-time-setup.ts`, `manage-secrets.ts`).

## 4) Change Playbooks

### A) Database Change (example: add column)

1. Edit `src/server/db/schema.ts`.
2. If auth user field changes, also edit:
   - `src/server/auth.ts` (`additionalFields`)
   - `src/types/better-auth.d.ts`
3. Generate migration:
   - `bun run db:generate`
4. Apply migration locally:
   - `bun run db:migrate:local` (or `bun run db:migrate:dev`)
5. Update repositories/routers/UI that read/write the field.

### B) Add a New Admin Action

1. Add repository function in `src/server/repositories/admin.ts`.
2. Add procedure in `src/server/api/routers/admin.ts` with zod input and proper error mapping.
3. Call from UI page in `src/app/admin/users/page.tsx` (or new admin page/component).
4. If new route, add navigation entry in `src/components/dashboard/app-sidebar.tsx`.

### C) Add a New API Endpoint

Choose one:
- tRPC endpoint: add to `src/server/api/routers/*` and register in `src/server/api/root.ts`.
- Next route handler: add `src/app/api/<segment>/route.ts`.

Use `getCurrentUser()` / `requireAuth()` patterns if auth is required.

### D) Add a New Cloudflare Binding

1. Add binding in `wrangler.json`.
2. Use it in server context (`getCloudflareContext`) where needed.
3. If workflow-related, wire exports in `worker.ts` and code in `src/server/workers/*`.

## 5) Coding Rules For This Repo

- Use TypeScript with strict types; prefer explicit interfaces/types for payloads.
- Use `@/` import aliases (configured in `tsconfig.json`).
- In tRPC routers, validate all procedure inputs with `zod`.
- Keep data access in repositories, not in UI components.
- Reuse existing error classes from `src/models/errors/*` rather than throwing raw `Error` in repository layer.
- Prefer shadcn UI patterns/components first, then reuse existing primitives from `src/components/ui/*` before adding custom controls.
- Reference the shadcn catalog/docs when choosing components: https://ui.shadcn.com/docs/components

## 6) Files/Folders Usually Not Edited Manually

- Generated/build outputs:
  - `.next/`
  - `.open-next/`
  - `cloudflare-env.d.ts` (typically generated via `bun run cf-typegen`)
- Local runtime state:
  - `.wrangler/`

## 7) Useful Commands

- Dev server: `bun run dev`
- Lint: `bun run lint`
- Tests: `bun run test:run`
- DB generate migration: `bun run db:generate`
- DB migrate local: `bun run db:migrate:local`
- Cloudflare preview build: `bun run preview`
- Deploy: `bun run deploy`
