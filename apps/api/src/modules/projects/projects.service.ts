import type { CreateProjectInput, Role, UpdateProjectInput } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import type { Project } from "../../db/schema";
import { auditService } from "../audit/audit.service";
import { storage } from "../storage/storage";
import { usersRepository } from "../users/users.repository";
import { membersRepository } from "./members.repository";
import { projectsRepository } from "./projects.repository";
import { slugify } from "./slug";

export type Actor = { id: string; role: Role };

const MAX_SLUG_ATTEMPTS = 20;

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Project topilmadi" });

const forbidden = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Bu amalni faqat project egasi yoki superadmin bajara oladi",
  });

/**
 * The single access rule. `manager` = owner or superadmin (members, ownership, archive, delete);
 * `member` = added to the project (everything else). Admins have no special access: they are
 * ordinary users here. Archived and foreign projects are NOT_FOUND so ids do not leak existence.
 */
export async function accessOf(
  actor: Actor,
  project: Project,
): Promise<"manager" | "member" | null> {
  if (project.archivedAt) return null;
  if (actor.role === "superadmin" || project.ownerId === actor.id) return "manager";
  return (await membersRepository.isMember(project.id, actor.id)) ? "member" : null;
}

function assertRetention(days: number | null) {
  if (days !== null && days > env.PDF_RETENTION_MAX_DAYS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Saqlash muddati ko'pi bilan ${env.PDF_RETENTION_MAX_DAYS} kun bo'lishi mumkin`,
    });
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!(await projectsRepository.slugExists(candidate))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export const projectsService = {
  async create(actor: Actor, input: CreateProjectInput): Promise<Project> {
    // Retry on a unique-slug race between the check and the insert.
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await projectsRepository.insert({
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description || null,
          slug: await uniqueSlug(input.name),
          ownerId: actor.id,
        });
        await auditService.record({
          action: "project.created",
          actorId: actor.id,
          targetType: "project",
          targetId: created.id,
          targetLabel: created.name,
        });
        return created;
      } catch (error) {
        const unique = String((error as Error).cause ?? error).includes("UNIQUE");
        if (!unique || attempt >= 3) throw error;
      }
    }
  },

  list(actor: Actor): Promise<Project[]> {
    return projectsRepository.list(actor.role === "superadmin" ? {} : { userId: actor.id });
  },

  /** Any access: owner, member or superadmin. */
  async get(actor: Actor, id: string): Promise<Project> {
    const project = await projectsRepository.findById(id);
    if (!project || !(await accessOf(actor, project))) throw notFound();
    return project;
  },

  /** Owner or superadmin only; a plain member gets FORBIDDEN (they already know it exists). */
  async getManaged(actor: Actor, id: string): Promise<Project> {
    const project = await projectsRepository.findById(id);
    const access = project ? await accessOf(actor, project) : null;
    if (!project || !access) throw notFound();
    if (access !== "manager") throw forbidden();
    return project;
  },

  /** Hands the project to another active user; the previous owner stays on as a member. */
  async transferOwner(actor: Actor, id: string, newOwnerId: string): Promise<void> {
    const project = await projectsService.getManaged(actor, id);
    if (newOwnerId === project.ownerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bu foydalanuvchi allaqachon egasi" });
    }
    const target = await usersRepository.findById(newOwnerId);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Foydalanuvchi topilmadi" });
    if (target.banned) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Bloklangan foydalanuvchiga berib bo'lmaydi",
      });
    }
    await membersRepository.transferOwner(id, project.ownerId, newOwnerId, actor.id);
    await auditService.record({
      action: "project.owner_changed",
      actorId: actor.id,
      targetType: "project",
      targetId: id,
      targetLabel: project.name,
      detail: `Yangi ega: ${target.name} <${target.email}>`,
    });
  },

  async update(actor: Actor, input: UpdateProjectInput): Promise<Project> {
    await projectsService.get(actor, input.projectId);
    assertRetention(input.retentionDays);
    const updated = await projectsRepository.update(input.projectId, {
      name: input.name,
      description: input.description || null,
      retentionDays: input.retentionDays,
    });
    if (!updated) throw notFound();
    await auditService.record({
      action: "project.updated",
      actorId: actor.id,
      targetType: "project",
      targetId: updated.id,
      targetLabel: updated.name,
    });
    return updated;
  },

  /** Permanent removal: needs the exact project name, refuses while documents are rendering. */
  async remove(actor: Actor, id: string, confirmName: string): Promise<void> {
    const project = await projectsService.getManaged(actor, id);
    if (confirmName.trim() !== project.name) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Project nomi mos kelmadi" });
    }
    if (await projectsRepository.activeJobs(id)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Hujjatlar yaratilmoqda. Tugashini kuting va qayta urining",
      });
    }
    const keys = await projectsRepository.deleteCascade(id);
    // Files go after the DB commit: a failed removal leaves an orphan file, never a broken row.
    await Promise.all(keys.map((key) => storage.remove(key).catch(() => undefined)));
    await auditService.record({
      action: "project.deleted",
      actorId: actor.id,
      targetType: "project",
      targetId: id,
      targetLabel: project.name,
    });
  },

  async archive(actor: Actor, id: string): Promise<void> {
    const project = await projectsService.getManaged(actor, id);
    await projectsRepository.archive(id, new Date());
    await auditService.record({
      action: "project.archived",
      actorId: actor.id,
      targetType: "project",
      targetId: id,
      targetLabel: project.name,
    });
  },
};
