# Documento

Monorepo: `apps/web` (React + Vite + Mantine, FSD) and `apps/api` (Hono + tRPC + Better Auth + Drizzle/PostgreSQL).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set BETTER_AUTH_SECRET
pnpm db:up                               # local Postgres (docker compose, port 5480)
pnpm db:setup                            # migrate + seed superadmin
pnpm dev                                 # web :3000, api :3001
```

Architecture, conventions and auth rules: see [CLAUDE.md](./CLAUDE.md).

## Production (Docker)

Three containers behind one origin: `web` (Caddy: TLS, the built SPA, proxy for `/api` and `/v1`) and `api`
(Hono + tRPC, Typst 0.15.1 and fonts included) and `postgres`. The database lives in the `pgdata`
volume, uploaded assets and generated PDFs in the `data` volume.

```bash
cp .env.docker.example .env     # set DOMAIN, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, SEED_SUPERADMIN_EMAIL/PASSWORD
docker compose up -d --build    # DNS for DOMAIN must point here, ports 80/443 open
docker compose logs -f api
```

- On every start the API applies migrations and creates the superadmin if none exists (both idempotent).
  Change the seed password after the first login.
- Update: `git pull && docker compose up -d --build`.
- Extra Typst fonts: put `.ttf`/`.otf` files in `./fonts` (mounted read-only into the font directory).
- Resource limits: `RENDER_MEMORY_BUDGET_MB` is what the render queue may use at once, `API_MEM_LIMIT`
  is the container ceiling (keep about 1 GB of headroom over the budget).
- Client IPs: Caddy passes the real address in `X-Forwarded-For`, which the sign-in throttle and the
  audit log use. If another proxy or load balancer sits in front of Caddy, configure Caddy
  `trusted_proxies` for it, or every request will look like it comes from that proxy.
- Single instance only: the rate limiters and the sign-in throttle are in memory.

### Backup

State is in two volumes: `pgdata` (database) and `data` (assets, PDFs).

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U documento -Fc documento > backups/db-$(date +%F).dump
docker compose cp api:/data/storage ./backups/storage-$(date +%F)
```

Restore: stop `api`, then
`docker compose exec -T postgres pg_restore -U documento -d documento --clean --if-exists < backups/db-<date>.dump`,
copy the storage folder back to `/data/storage`, start `api`.
