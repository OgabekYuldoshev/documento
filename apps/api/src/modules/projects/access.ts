import { and, eq, exists, or, sql } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { project, projectMember } = schema;

/** SQL filter: projects the user owns or is a member of (the superadmin simply skips it). */
export const visibleTo = (userId: string) =>
  or(
    eq(project.ownerId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(projectMember)
        .where(and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))),
    ),
  );
