# Documento

Turborepo + pnpm monorepo. Two apps, one shared package, end-to-end type safety via tRPC.

> Read `AGENTS.md` before touching Turborepo config (`turbo.json`, `turbo` commands): docs for the installed version live in `node_modules/turbo/docs`.

## Stack

| Area | Choice |
|------|--------|
| Monorepo | pnpm 11 workspaces + Turborepo 2, Node >= 24, TypeScript 7 (strict) |
| Web (`apps/web`) | React 19, Vite, TypeScript, **Mantine 9** (light + dark theme), React Router (data router), TanStack Query, **Feature-Sliced Design** |
| API (`apps/api`) | **Hono** (Node), **tRPC 11**, **Better Auth** (cookie sessions, admin plugin), **Drizzle ORM + SQLite** (libSQL driver), Zod |
| Shared (`packages/shared`) | Zod schemas + role constants used by both apps |
| Tooling | **Biome** (lint + format + import sort), **lefthook** git hooks, **commitlint** (Conventional Commits) |

SQLite only. Never introduce Postgres.

## Repository layout

```
apps/
  api/                 Hono + tRPC + Better Auth + Drizzle
  web/                 React + Vite + Mantine (FSD)
packages/
  shared/              @documento/shared  (zod schemas, roles) - source-exported TS
  typescript-config/   @documento/typescript-config (base.json, node.json, react.json)
biome.json  lefthook.yml  commitlint.config.js  turbo.json  pnpm-workspace.yaml
```

## Commands (run from repo root)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env    # then set BETTER_AUTH_SECRET (>=32 chars) and seed credentials
pnpm db:setup        # migrate + seed first superadmin (idempotent)
pnpm dev             # web http://localhost:3000, api http://localhost:3001
pnpm check-types     # tsc across all packages
pnpm lint            # biome check .   (pnpm lint:fix to autofix)
pnpm db:generate     # drizzle-kit generate after editing src/db/schema
pnpm db:studio
```

Dev login: seed credentials from `apps/api/.env` (`SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`).

pnpm 11 blocks dependency build scripts: allowed ones are listed under `allowBuilds` in `pnpm-workspace.yaml`.

## How web <-> api talk

- Browser only ever hits **its own origin**. Vite dev server proxies `/api/*` to the API (`vite.config.ts`), so session cookies are same-origin: no CORS/SameSite pain. In production put both behind one origin (reverse proxy) the same way.
- `/api/auth/*` -> Better Auth handler (sign-in, sign-out, session). Used via `authClient` (`apps/web/src/shared/api/auth-client.ts`).
- `/api/trpc/*` -> tRPC router. Used via `trpc` options proxy (`apps/web/src/shared/api/trpc.ts`): `useQuery(trpc.users.list.queryOptions())`, `useMutation(trpc.users.create.mutationOptions())`. Transformer: superjson (Dates stay Dates).
- Types flow from `apps/api/src/app-router.ts` (`AppRouter`) into web with `import type { AppRouter } from "@documento/api"`. **Type-only import, never import API runtime code from web.**
- Input validation schemas shared by both sides live in `packages/shared` (web forms use `zod4Resolver`, API uses them in `.input()`).

## Authentication & authorization

- Cookie-based sessions (httpOnly, SameSite=Lax, `documento.*` prefix, 7 days).
- **No public sign-up.** `emailAndPassword.disableSignUp = true`, and the Hono app also 404s `/api/auth/sign-up/*` and `/api/auth/admin/*`. Users are created/banned/removed **only through tRPC** (`users.*`), which enforces role rules in `modules/users/users.service.ts` and then calls `auth.api.*` with the actor's headers.
- Roles: `superadmin` > `admin` > `user` (`packages/shared/src/roles.ts`).
  - superadmin creates/blocks/deletes admins + users; admin only manages `user`s; nobody acts on themselves; nobody touches a superadmin.
  - Create-role matrix is `ASSIGNABLE_ROLES`; keep API checks and UI in sync with it.
- **Superadmin is undeletable**: enforced at DB level by SQLite triggers (`0001_protect_superadmin.sql`: no delete, no demote, no ban) in addition to service checks. Never drop these triggers.
- First superadmin comes from `pnpm db:setup` (`src/db/seed.ts`, idempotent, skips if any superadmin exists). Change the seed password immediately outside local dev.
- tRPC procedure tiers (`apps/api/src/trpc/init.ts`): `publicProcedure`, `protectedProcedure` (adds `ctx.actor`), `adminProcedure`, `superadminProcedure`. Pick the strictest that fits.
- Web guards are router loaders in `apps/web/src/app/router/guards.ts` (`requireAuth`, `requireGuest`, `requireAdmin`). They are UX only; the API is the real authority.

## API architecture (`apps/api/src`) - feature-based, layered

```
index.ts            node server bootstrap
app.ts              Hono app: middleware, auth handler mount, tRPC mount
app-router.ts       root tRPC router + exported AppRouter type
config/env.ts       zod-validated env (single source, import { env })
db/                 client.ts, schema/ (drizzle tables), migrations/, migrate.ts, seed.ts
lib/auth.ts         Better Auth instance
trpc/init.ts        context, initTRPC, procedure tiers
modules/<feature>/  one folder per feature
  <feature>.router.ts      thin: input schema + auth tier + call service
  <feature>.service.ts     business rules / permissions
  <feature>.repository.ts  drizzle queries only
```

Rules:
- Router -> service -> repository. Routers never touch the DB; repositories hold no business rules.
- New feature = new `modules/<name>/` + register in `app-router.ts`. Shared zod inputs go in `packages/shared`.
- Schema change: edit `db/schema/*`, run `pnpm db:generate`, commit the migration, `pnpm db:setup`. Custom SQL via `drizzle-kit generate --custom`. Better Auth tables (`user/session/account/verification` + admin plugin columns) must match what the plugin expects.
- Throw `TRPCError` for expected failures; map Better Auth `APIError` (see `rethrow` in users.service).
- Env: add new vars to `config/env.ts` AND `.env.example`.

## Web architecture (`apps/web/src`) - Feature-Sliced Design

Layers, top to bottom. **A module may import only from layers strictly below it; never sideways inside a layer; each slice exposes a public API through `index.ts` and others import only from that.**

```
app/        entry (main.tsx), providers/, router/ (routes + guards), theme/ (Mantine theme), styles/
pages/      one slice per route: pages/<name>/{ui,index.ts}  (compose widgets + features only)
widgets/    big self-contained UI blocks (app-shell, users-table, stats-grid)
features/   user actions with business value: features/<domain>/<action>/{ui,model,index.ts}
            (auth/login, auth/logout, users/create-user, users/toggle-ban, users/delete-user, theme/toggle-color-scheme)
entities/   business objects: entities/<name>/{api,model,ui,index.ts}  (session, user)
shared/     reusable, domain-free: api/ (trpc, auth-client, query-client), config/ (routes), lib/, ui/ (PageHeader, StatCard, ConfirmModal)
```

Conventions:
- Alias `@/` -> `apps/web/src/`.
- Segments inside a slice: `ui/` components, `model/` hooks/state/types, `api/` queries. Mutation hooks live in the feature's `model/`.
- Server state = TanStack Query through `trpc.*.queryOptions()/mutationOptions()`. After user mutations call `invalidateUserQueries()` (`features/users/invalidate.ts`).
- Forms: `@mantine/form` + `zod4Resolver` with schema from `@documento/shared`.
- Session: `entities/session` (`useSession()`, `getSessionUser()` for loaders). Login/logout invalidate/clear it.
- UI is **Mantine only** (no other component libs, no ad-hoc CSS frameworks). Icons: `@tabler/icons-react`. Use theme tokens/props (`c="dimmed"`, `var(--mantine-color-*)`) so both color schemes work; never hardcode colors that break dark mode. Theme lives in `app/theme/index.ts`; color scheme is `auto` + `ColorSchemeToggle`.
- Components are small and reusable; shared primitives go to `shared/ui`, domain bits to the entity/feature that owns them.
- Routes are constants in `shared/config/routes.ts`.

## Conventions

- TypeScript strict, `verbatimModuleSyntax` (use `import type`), no `any`.
- Biome is the only linter/formatter (2 spaces, double quotes, 100 cols). Do not add ESLint/Prettier.
- Commits follow Conventional Commits, validated by lefthook `commit-msg` (commitlint): `feat(web): add users page`. Scopes: `web, api, shared, config, deps, docs` (warn-level).
- Pre-commit runs `biome check --write` on staged files; pre-push runs `pnpm check-types`.
- Don't commit `.env` or `apps/api/data/*.db`.

## Roadmap / not built yet

Phase 1 (done): auth flow (login/logout, session, guards), seeded superadmin, admin-only user management, dashboard with stats, light/dark theme.
Next candidates: password change / admin password reset, profile page, audit log, rate limiting on sign-in, tests (Vitest), production deploy (single origin reverse proxy, secure cookies via `NODE_ENV=production`).
