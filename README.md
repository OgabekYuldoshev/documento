# Documento

Monorepo: `apps/web` (React + Vite + Mantine, FSD) and `apps/api` (Hono + tRPC + Better Auth + Drizzle/SQLite).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set BETTER_AUTH_SECRET
pnpm db:setup                            # migrate + seed superadmin
pnpm dev                                 # web :3000, api :3001
```

Architecture, conventions and auth rules: see [CLAUDE.md](./CLAUDE.md).
