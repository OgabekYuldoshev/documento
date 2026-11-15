import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { ts } from "./columns";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /** null = use the global default (PDF_RETENTION_DAYS). */
    retentionDays: integer("retention_days"),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("project_owner_id_idx").on(t.ownerId)],
);

export type Project = typeof project.$inferSelect;

/**
 * People (besides the owner) who may work in a project. The owner is `project.owner_id`, never
 * a row here. Rows go with the user (cascade) or the project (removed in `deleteCascade`).
 */
export const projectMember = pgTable(
  "project_member",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_member_user_idx").on(t.userId),
  ],
);

export type ProjectMember = typeof projectMember.$inferSelect;
