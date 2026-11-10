import {
  type CreateProjectInput,
  isAdminRole,
  type Role,
  type UpdateProjectInput,
} from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import type { Project } from "../../db/schema";
import { storage } from "../storage/storage";
import { projectsRepository } from "./projects.repository";
import { slugify } from "./slug";

export type Actor = { id: string; role: Role };

const MAX_SLUG_ATTEMPTS = 20;

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Project topilmadi" });

/**
 * The single ownership rule: owner, or admin/superadmin.
 * Foreign projects are reported as NOT_FOUND so ids do not leak existence.
 */
export function assertCanAccess(actor: Actor, project: Project): void {
  if (project.archivedAt) throw notFound();
  if (project.ownerId !== actor.id && !isAdminRole(actor.role)) throw notFound();
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
        return await projectsRepository.insert({
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description || null,
          slug: await uniqueSlug(input.name),
          ownerId: actor.id,
        });
      } catch (error) {
        const unique = String((error as Error).cause ?? error).includes("UNIQUE");
        if (!unique || attempt >= 3) throw error;
      }
    }
  },

  list(actor: Actor): Promise<Project[]> {
    return projectsRepository.list(isAdminRole(actor.role) ? {} : { ownerId: actor.id });
  },

  async get(actor: Actor, id: string): Promise<Project> {
    const project = await projectsRepository.findById(id);
    if (!project) throw notFound();
    assertCanAccess(actor, project);
    return project;
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
    return updated;
  },

  /** Permanent removal: needs the exact project name, refuses while documents are rendering. */
  async remove(actor: Actor, id: string, confirmName: string): Promise<void> {
    const project = await projectsService.get(actor, id);
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
  },

  async archive(actor: Actor, id: string): Promise<void> {
    await projectsService.get(actor, id);
    await projectsRepository.archive(id, new Date());
  },
};
