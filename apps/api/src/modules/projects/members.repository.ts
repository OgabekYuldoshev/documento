import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { project, projectMember, user } = schema;

export const membersRepository = {
  async isMember(projectId: string, userId: string) {
    const [row] = await db
      .select({ userId: projectMember.userId })
      .from(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
      .limit(1);
    return Boolean(row);
  },

  list(projectId: string) {
    return db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        banned: user.banned,
        addedAt: projectMember.createdAt,
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId))
      .orderBy(asc(projectMember.createdAt));
  },

  async add(projectId: string, userId: string, addedBy: string) {
    await db.insert(projectMember).values({ projectId, userId, addedBy });
  },

  /** True when a row was removed. */
  async remove(projectId: string, userId: string) {
    const rows = await db
      .delete(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
      .returning({ userId: projectMember.userId });
    return rows.length > 0;
  },

  /** New owner takes over; the previous owner stays on as a member (no access is lost). */
  async transferOwner(projectId: string, oldOwnerId: string, newOwnerId: string, actorId: string) {
    await db.transaction(async (tx) => {
      await tx.update(project).set({ ownerId: newOwnerId }).where(eq(project.id, projectId));
      // The owner is implicit: never also a member.
      await tx
        .delete(projectMember)
        .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, newOwnerId)));
      await tx
        .insert(projectMember)
        .values({ projectId, userId: oldOwnerId, addedBy: actorId })
        .onConflictDoNothing();
    });
  },
};
