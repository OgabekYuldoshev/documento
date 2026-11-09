import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { user } from "../../db/schema";

const columns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  createdAt: user.createdAt,
};

export const usersRepository = {
  list: (limit?: number) => {
    const query = db.select(columns).from(user).orderBy(desc(user.createdAt));
    return limit ? query.limit(limit) : query;
  },

  findById: async (id: string) => {
    const [row] = await db.select(columns).from(user).where(eq(user.id, id)).limit(1);
    return row ?? null;
  },

  stats: async () => {
    const [row] = await db
      .select({
        total: count(),
        banned: sql<number>`coalesce(sum(${user.banned}), 0)`,
        admins: sql<number>`coalesce(sum(${user.role} in ('admin','superadmin')), 0)`,
      })
      .from(user);
    const total = row?.total ?? 0;
    const banned = Number(row?.banned ?? 0);
    return { total, banned, active: total - banned, admins: Number(row?.admins ?? 0) };
  },
};
