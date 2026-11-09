import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { auth } from "../lib/auth";
import { db, schema, sqlite } from "./client";

/** Idempotent: creates the first superadmin when none exists. */
async function seedSuperadmin() {
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "superadmin"))
    .limit(1);

  if (existing.length > 0) {
    console.log("• superadmin already exists, skipping");
    return;
  }

  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(env.SEED_SUPERADMIN_PASSWORD);

  const userId = randomUUID();
  await db.batch([
    db.insert(schema.user).values({
      id: userId,
      name: env.SEED_SUPERADMIN_NAME,
      email: env.SEED_SUPERADMIN_EMAIL.toLowerCase(),
      emailVerified: true,
      role: "superadmin",
    }),
    db.insert(schema.account).values({
      id: randomUUID(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
    }),
  ]);

  console.log(`✔ superadmin created: ${env.SEED_SUPERADMIN_EMAIL}`);
}

await seedSuperadmin();
sqlite.close();
