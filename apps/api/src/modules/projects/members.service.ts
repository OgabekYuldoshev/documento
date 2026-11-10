import { TRPCError } from "@trpc/server";
import type { Project } from "../../db/schema";
import { auditService } from "../audit/audit.service";
import { usersRepository } from "../users/users.repository";
import { membersRepository } from "./members.repository";
import { type Actor, accessOf } from "./projects.service";

const fail = (code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST" | "FORBIDDEN", message: string) =>
  new TRPCError({ code, message });

export type ProjectPerson = {
  userId: string;
  name: string;
  email: string;
  kind: "owner" | "member";
  addedAt: Date | null;
};

export const membersService = {
  /** The owner first, then the members in the order they joined. */
  async list(project: Project): Promise<ProjectPerson[]> {
    const owner = await usersRepository.findById(project.ownerId);
    const members = await membersRepository.list(project.id);
    return [
      ...(owner
        ? [
            {
              userId: owner.id,
              name: owner.name,
              email: owner.email,
              kind: "owner" as const,
              addedAt: null,
            },
          ]
        : []),
      ...members.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        kind: "member" as const,
        addedAt: m.addedAt,
      })),
    ];
  },

  /** `project` was loaded through the manager-only guard. */
  async add(actor: Actor, project: Project, email: string): Promise<void> {
    const target = await usersRepository.findByEmail(email);
    if (!target) throw fail("NOT_FOUND", "Bunday email bilan foydalanuvchi topilmadi");
    if (target.banned) throw fail("BAD_REQUEST", "Bloklangan foydalanuvchini qo'shib bo'lmaydi");
    if (target.id === project.ownerId) throw fail("CONFLICT", "Bu foydalanuvchi project egasi");
    if (await membersRepository.isMember(project.id, target.id)) {
      throw fail("CONFLICT", "Bu foydalanuvchi allaqachon a'zo");
    }
    await membersRepository.add(project.id, target.id, actor.id);
    await auditService.record({
      action: "project.member_added",
      actorId: actor.id,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      detail: `${target.name} <${target.email}>`,
    });
  },

  /** Managers remove anyone; a member may only remove themselves (leave). */
  async remove(actor: Actor, project: Project, userId: string): Promise<void> {
    const access = await accessOf(actor, project);
    if (access !== "manager" && userId !== actor.id) {
      throw fail("FORBIDDEN", "Bu amalni faqat project egasi yoki superadmin bajara oladi");
    }
    if (userId === project.ownerId) {
      throw fail("BAD_REQUEST", "Egasini a'zolikdan olib bo'lmaydi. Avval egasini almashtiring");
    }
    if (!(await membersRepository.remove(project.id, userId))) {
      throw fail("NOT_FOUND", "A'zo topilmadi");
    }
    const target = await usersRepository.findById(userId);
    await auditService.record({
      action: "project.member_removed",
      actorId: actor.id,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      detail: target ? `${target.name} <${target.email}>` : userId,
    });
  },
};
