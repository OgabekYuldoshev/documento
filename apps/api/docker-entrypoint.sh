#!/bin/sh
# Apply migrations, make sure a superadmin exists (both idempotent), then run the API as PID 1.
set -e
node --import tsx src/db/migrate.ts
node --import tsx src/db/seed.ts
exec node --import tsx src/index.ts
