# Documento

Turborepo + pnpm monorepo. Two apps, one shared package, end-to-end type safety via tRPC.

> Read `AGENTS.md` before touching Turborepo config (`turbo.json`, `turbo` commands): docs for the installed version live in `node_modules/turbo/docs`.

## Stack

| Area | Choice |
|------|--------|
| Monorepo | pnpm 11 workspaces + Turborepo 2, Node >= 24, TypeScript 7 (strict) |
| Web (`apps/web`) | React 19, Vite, TypeScript, **Mantine 9** (light + dark theme, SCSS modules for special cases), React Router (data router), TanStack Query, TanStack Table v9, **Feature-Sliced Design** |
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
pnpm test            # vitest (apps/api, in-memory SQLite, migrations applied per test file)
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

## Projects (phase 2, M1 done)

- Table `project` (`db/schema/projects.ts`), module `modules/projects/` (`projects.{router,service,repository}.ts`, `slug.ts`, `project-procedure.ts`).
- **Ownership rule lives only in `assertCanAccess`** (`projects.service.ts`): owner, or admin/superadmin. Foreign, missing and archived projects all return `NOT_FOUND` (no existence leak). Any signed-in user may create projects.
- **Every project-scoped tRPC procedure must extend `projectProcedure`** (`.input({ projectId })`, exposes `ctx.project`); add more fields with `.input(...)`.
- `retentionDays` null = global `PDF_RETENTION_DAYS`; max `PDF_RETENTION_MAX_DAYS` (env). Slug is generated once from the name and never changes.
- `users.remove` refuses (CONFLICT) while the user owns projects (FK `restrict`).
- Web: `entities/project`, `features/projects/{create,archive,update}-project`, `widgets/projects-table`, `pages/{projects,project}`. Design: `docs/superpowers/specs/2026-11-09-projects-templates-generation-design.md`; plans in `docs/superpowers/plans/`.
- Tests: `apps/api/test/*.test.ts`, helpers in `test/factories.ts` (`createUser`, `callerFor(actor)`, `anonymousCaller()`).

## Templates (phase 2, M2 done)

- Tables `template`, `template_version` (`db/schema/templates.ts`); module `modules/templates/` (`templates.{router,service,repository}.ts`, `template-procedure.ts`, `validate-data.ts`).
- **Schema is a real JSON Schema (draft-07), written as JSON in the editor.** Validated by Ajv **strict** + **ajv-formats (full mode)** in `validateData` (Uzbek messages, JSON-pointer paths, cached per schema); `assertSchemaCompiles` rejects unusable schemas at `saveDraft`/`publish` (BAD_REQUEST `Schema noto'g'ri: ...`). `packages/shared/src/template-schema.ts` holds Ajv-free rules: `templateSchemaSchema` (root `type: object`, depth<=5, <=200 properties, safe regex only, property names `^[A-Za-z_]\w{0,63}$`, reserved names blocked, **no `$ref`**, only draft-07 `$schema`), `sampleFromSchema`, `diffSchemas` (breaking changes), `collectImages`/`transformImages`. Image field = `{ "type": "string", "format": "image", "x-image": { formats, maxSizeMb, maxMegapixels } }` (custom Ajv format = upload id `upl_...`). `TemplateSchema` is just `JsonSchema`.
- Versions: one **draft** per template (partial unique index), **published** immutable, previous published becomes `archived`. Edit = `getDraft` (copies current into a new draft). `publish` needs `acknowledgeBreaking: true` when `diffSchemas` finds breaking changes; sampleData must validate at publish (not at save). `publishChecks` in `templates.service.ts` is the M3 hook for the Typst dry-run.
- Every template procedure extends `templateProcedure` (= `projectProcedure` + `{ templateId }`, NOT_FOUND across projects).
- Web: `entities/template`, `features/templates/{create-template,edit-template}`, `widgets/templates-table`, `pages/template` (editor: Typst code, JSON Schema editor, sample JSON, files, limits, version history). Schema and sample are CodeMirror JSON editors (`JsonEditor`); the PDF preview re-renders automatically ~0.8 s after typing stops (`useDraftEditor`). CodeMirror, live preview and assets arrive in M3.

## Render (phase 2, M3a done)

- `modules/render/`: `typst-runner.ts` (one Typst child process per job in a temp dir `--root`, `--ignore-system-fonts --font-path $FONTS_DIR`, empty package dirs, blackholed proxy env, `@pkg` imports rejected up front, process-group kill on timeout, `prlimit --as/--cpu` when available: **macOS dev has no prlimit, memory limit is then NOT enforced**), `diagnostics.ts` (short format parser), `scheduler.ts` (strict-FIFO memory budget `RENDER_MEMORY_BUDGET_MB`), `render.service.ts` (`renderPreview`, `runPublishDryRun`).
- `templates.preview` renders unsaved editor state (PDF inline base64, <= 20 MB). `publishChecks` runs the dry-run with **warnings as errors** (unknown font blocks publish); `PUBLISH_DRY_RUN=off` only in vitest.
- Env: `TYPST_BIN`, `FONTS_DIR`, `RENDER_MEMORY_BUDGET_MB`. Typst tests are skipped unless Typst is installed: run `TYPST_BIN=/path/typst FONTS_DIR=/path/fonts npx vitest run` inside `apps/api` (turbo strips env vars). The starter template uses font Inter: it must exist in `FONTS_DIR`.
- Web editor: CodeMirror 6 (`SourceEditor`) + `PreviewPanel` (iframe on a Blob URL, diagnostics with line numbers). Next (M3b): template assets, `generation` table + persistent queue.

## Assets, storage, generation queue (phase 2, M3b done)

- `modules/storage/storage.ts`: `Storage` interface (`put`, `putFile`, `getPath`, `remove`), local FS under `STORAGE_DIR`, keys validated (no traversal). Swap for S3 later behind the same interface.
- Assets (`modules/assets/`): table `template_asset` (per template, shared by all versions), upload is a Hono multipart route `POST /api/templates/:templateId/assets` (tRPC cannot stream binaries), list/delete via `templateAssets.*`. `inspectAsset` checks magic bytes vs extension, <= 40 MP raster from the header, SVG ENTITY ban; names `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, <= 50 files, `ASSET_MAX_MB`. Typst sees them as `assets/<name>` (fonts also via `--font-path`). webp is not supported yet.
- Generations (`modules/generations/`): table `generation` (status `queued|processing|ok|validation_error|render_error|timeout|expired`; **input data is never stored**, only its SHA-256; the job file in `jobs/<id>.json` is deleted after render). `queue.ts` claims jobs atomically (`claimNext`), `RENDER_CONCURRENCY` caps claims, the memory scheduler gates renders, `startQueue()` (called from `index.ts`) requeues jobs left `processing` after a crash. PDFs go to `pdf/<id>.pdf`, expiry = project `retentionDays` or `PDF_RETENTION_DAYS`. `GET /api/generations/:id/file` streams the PDF (410 after expiry). `generations.create` queues a UI test run and can wait up to 25 s. API-key requests and the retention cleaner (marks `expired`, deletes files) come in M4/M5.

## API keys and external API (phase 2, M4 done)

- Keys are custom (Better Auth's plugin binds to users; we need project/template scope, rate limit, audit). Format `dk_live_<8 hex prefix>_<48 hex>`; only the SHA-256 hash is stored, prefix is unique and used for lookup, comparison is constant-time, the full key is returned **once** by `apiKeys.create`. Module `modules/api-keys/` (`key-format.ts`, service, repository, `apiKeys.{list,create,revoke}` behind `projectProcedure`). Keys are revoked, never deleted.
- `/v1` (`modules/v1/`, Hono sub-app mounted at `/v1`, no CORS): auth middleware (`Authorization: Bearer` or `x-api-key`) -> in-memory token-bucket rate limit per key (`RateLimit-*`, 429 + `Retry-After`; single-instance only) -> routes. Errors are RFC 9457 `application/problem+json` (`problem.ts`). Routes: `GET /templates`, `GET /templates/:slug` (current JSON Schema), `POST /templates/:slug/generate` (`{data}`; waits `SYNC_WAIT_MS` (25 s) then `202` + `Location`; `Prefer: respond-async` returns 202 at once; `?response=json`; `?version=N`; `Idempotency-Key` replays, other data under the same key = 409), `GET /documents/:id`, `GET /documents/:id/file` (410 after expiry), `GET /openapi.json` (3.1, only what the key may use).
- Status mapping for generate: validation_error 422 (JSON-pointer `errors`), timeout 504, render_error 500, payload > template `maxPayloadKb` 413. Foreign/unknown documents are 404, a template outside key scope is 403.
- Web: project tab "API keylar" (`entities/api-key`, `features/api-keys/{create-api-key,revoke-api-key}`, `widgets/api-keys-table`); creation shows the secret once in a modal.
- Uploads (`modules/uploads/`): `POST /v1/uploads` takes a **raw binary body** (png/jpeg/svg, detected by content via `inspectContent`, not multipart), streams to a temp file (<= `UPLOAD_MAX_MB`), per-project active quota `UPLOAD_PROJECT_QUOTA_MB` (413 `quota_exceeded`), table `upload` (id `upl_<24 hex>`, expires after `UPLOAD_TTL_MINUTES`, swept every 10 min by `startUploadCleaner`). Returns `{uploadId, mime, bytes, width, height, expiresAt}`.
- `image` fields take an upload id. `uploadsService.resolveImages` runs in `generations.create` (same project, not expired, `formats`/`maxSizeMb`/`maxMegapixels`; failures -> `validation_error` with JSON-pointer path, codes `image_not_found|image_format|image_size|image_pixels`; used uploads are extended to >= 1 h) and again in `queue.processJob`. `renderToFile` swaps ids for `uploads/<id>.<ext>` via `transformImages` and copies files into the job dir (`extraFiles`). Preview and publish dry-run use `images: { placeholder: true }` (built-in PNG), so sample data needs no real upload.
- Not built yet: webhook (M6), webp.

## Generation log, retention, snippets (phase 2, M5 done)

- Retention: `generationsService.cleanExpired()` deletes PDFs whose `pdfExpiresAt` passed and marks the row `expired` (row kept as history, `pdfKey` nulled). `startRetentionCleaner()` (called from `index.ts`) sweeps at boot and every 10 min; uploads have their own sweeper.
- Web: project tab "Hujjatlar" (`entities/generation`, `widgets/generations-table`): DataTable with time, template, source (UI/API), status badge (tooltip shows the first validation error / Typst diagnostic), pages, size, duration, PDF download (`/api/generations/:id/file`); polls every 3 s while jobs are queued/processing.
- Template page section "API orqali ishlatish" (`features/templates/edit-template/ui/ApiSnippets.tsx`, `model/snippets.ts`): cURL / Node.js / Python for `POST /v1/templates/:slug/generate`, body from `templates.apiExample` (sample generated from the published schema).

## Account, audit, sign-in throttle (phase 3 done)

- Account: `/profile` (tabs Profil/Parol). Name editable via `authClient.updateUser`; **email is read-only** (admins provision accounts). Password via `authClient.changePassword` (+ optional revoke of other sessions). Project delete: `projects.delete` (type the exact name, cascades rows + files, refused while jobs run).
- Admin password reset: `users.resetPassword` (`adminProcedure`, same `assertCanManage` rank rules, calls `auth.api.setUserPassword` + `revokeUserSessions`). Web: `features/users/reset-password` (generate/copy password).
- Audit: table `audit_log` (no FKs, name snapshots, append-only), `modules/audit/` (`auditService.record()` is best-effort and never throws; `audit.list` admin-only, filter by action, last 500). Action keys + Uzbek labels in `packages/shared/src/audit.ts` (`AUDIT_ACTIONS`): add a key there when auditing a new action. Recorded in services (users, projects, api-keys) and in the Hono auth guards (sign-in ok/failed/blocked with IP, password change). Web: `pages/audit` + `widgets/audit-table`, nav item "Audit log" (admin only).
- Sign-in throttle: `modules/auth/login-guard.ts` (in-memory, single instance): `LOGIN_MAX_FAILURES` failures per email (x4 per IP) inside `LOGIN_LOCKOUT_MINUTES` -> 429 `TOO_MANY_ATTEMPTS` + `Retry-After`. Wired in `auth.guard.ts` (`signInGuard`, `changePasswordGuard`) in front of Better Auth in `app.ts`. IP = first `X-Forwarded-For` hop: the reverse proxy must set it.

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
- **Styling:** Mantine props/theme first. Use a SCSS module **only** for specific cases props cannot express (hover/open states on custom triggers, layered/decorative visuals, pseudo-elements). Such a component gets its own kebab-case folder: `example-card/{example-card.tsx, example-card.module.scss, index.ts}` (`index.ts` re-exports). Plain components without custom CSS stay as a single file. Use `@mixin hover` / `light-dark()` / Mantine CSS vars inside SCSS so both schemes work. Examples: `widgets/app-shell/ui/sidebar-user-menu`, `pages/login/ui/document-preview`.
- **Theme tokens** (`app/theme/`): `palette.ts` (brand / dark / gray scales), `index.ts` (theme + `cssVariablesResolver`). Semantic surface vars for both schemes: `--app-canvas` (page bg), `--app-surface` (cards, header, navbar, popups), `--app-subtle`, `--app-border`. Paper/Menu/Modal/Popover use `--app-surface`; do not hardcode hex in components. Font: Inter Variable.
- **App shell** (`widgets/app-shell`, Mantine `layout="alt"`): full-height sidebar (logo, grouped nav with section captions, user block in footer with account menu) + top header over content only (sidebar collapse toggle persisted in localStorage, color-scheme toggle; no search/notifications by design). Nav is data-driven in `model/navigation.ts` (groups, `adminOnly`); adding a page = add a route + a nav item.
- SCSS gotcha: sass runs before PostCSS, so `@mixin hover`/`$mantine-breakpoint-*` do not work in `.module.scss`; use `@media (hover: hover)` and literal `48em`. Mantine resets (UnstyledButton sets `border: 0` and its own `font-size`) need `button.className` for specificity.
- **Tables: always use `DataTable`** (`shared/ui/data-table`, TanStack Table **v9** - feature-registry API, not v8; read `node_modules/@tanstack/react-table/skills/*` before changing it). It gives sorting, global search, client pagination + page size, loading skeleton, empty/error states, dark/light styling, Uzbek labels. Usage: define columns with `createDataTableColumns<Row>()` (typed helper) in the owning slice's `model/` (see `widgets/users-table/model/use-users-columns.tsx`), then `<DataTable columns data getRowId isLoading error toolbar initialSorting />`. Per-column options: `enableSorting`, `enableGlobalFilter: false`, `sortFn: "basic" | "datetime" | "text" | "alphanumeric"`, `meta: { align, width }`. Keep `columns` memoized and fallback data stable (v9 invalidates row models on new identities). Server-side pagination/filtering is not built in yet: add it to `features.ts` (manual* options) when an endpoint needs it.
- Components are small and reusable; shared primitives go to `shared/ui`, domain bits to the entity/feature that owns them.
- Routes are constants in `shared/config/routes.ts`.

## Conventions

- **UI language: Uzbek (Latin).** All user-visible text is Uzbek: web labels/toasts, zod messages in `packages/shared`, and TRPCError / Better Auth error messages shown to users (map Better Auth codes in `users.service.ts` `AUTH_ERRORS` and `useLogin.ts` `LOGIN_ERRORS`). Role names via `getRoleLabel()` (superadmin -> "Superadmin", admin -> "Admin", user -> "Foydalanuvchi"). Dates via `shared/lib/format.ts` `formatDate` (manual Uzbek months; browser ICU `uz` data is unreliable). Code, identifiers, logs and commits stay English. Use `'` in words like `o'` / `g'` (straight apostrophe).
- TypeScript strict, `verbatimModuleSyntax` (use `import type`), no `any`.
- Biome is the only linter/formatter (2 spaces, double quotes, 100 cols). Do not add ESLint/Prettier.
- Commits follow Conventional Commits, validated by lefthook `commit-msg` (commitlint): `feat(web): add users page`. Scopes: `web, api, shared, config, deps, docs` (warn-level).
- Pre-commit runs `biome check --write` on staged files; pre-push runs `pnpm check-types`.
- Don't commit `.env` or `apps/api/data/*.db`.

## Roadmap / not built yet

Phase 1 (done): auth flow (login/logout, session, guards), seeded superadmin, admin-only user management, dashboard with stats, light/dark theme.
Next candidates: webhook (M6), production deploy (single origin reverse proxy, secure cookies via `NODE_ENV=production`).
