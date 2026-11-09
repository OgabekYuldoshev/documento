import { randomUUID } from "node:crypto";
import type { Role } from "@documento/shared";
import { appRouter } from "../src/app-router";
import { db, schema } from "../src/db/client";
import { type Context, createCallerFactory } from "../src/trpc/init";

const createCaller = createCallerFactory(appRouter);

export async function createUser(
  overrides: Partial<{ id: string; name: string; email: string; role: Role }> = {},
) {
  const id = overrides.id ?? randomUUID();
  const role = overrides.role ?? "user";
  await db.insert(schema.user).values({
    id,
    name: overrides.name ?? `User ${id.slice(0, 6)}`,
    email: overrides.email ?? `${id}@test.local`,
    role,
  });
  return { id, role };
}

export function callerFor(actor: { id: string; role: Role }) {
  const ctx = {
    headers: new Headers(),
    session: {
      user: { id: actor.id, role: actor.role, name: "Test", email: "t@test.local", image: null },
    },
  } as unknown as Context;
  return createCaller(ctx);
}

export function anonymousCaller() {
  return createCaller({ headers: new Headers(), session: null } as unknown as Context);
}
