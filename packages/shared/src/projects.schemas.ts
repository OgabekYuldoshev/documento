import { z } from "zod";

export const PROJECT_NAME_MAX = 100;
export const PROJECT_DESCRIPTION_MAX = 500;

const nameSchema = z
  .string()
  .trim()
  .min(2, "Kamida 2 ta belgi")
  .max(PROJECT_NAME_MAX, `Ko'pi bilan ${PROJECT_NAME_MAX} ta belgi`);

const descriptionSchema = z
  .string()
  .trim()
  .max(PROJECT_DESCRIPTION_MAX, `Ko'pi bilan ${PROJECT_DESCRIPTION_MAX} ta belgi`);

export const PROJECTS_PAGE_MAX = 100;

/** Server-side paging for the projects table. */
export const listProjectsSchema = z.object({
  limit: z.number().int().min(1).max(PROJECTS_PAGE_MAX).default(25),
  offset: z.number().int().min(0).default(0),
  search: z.string().trim().max(100).optional(),
});
export type ListProjectsInput = z.input<typeof listProjectsSchema>;

export const projectIdSchema = z.object({ projectId: z.string().min(1) });

export const createProjectSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  projectId: z.string().min(1),
  name: nameSchema,
  description: descriptionSchema.nullable(),
  retentionDays: z
    .number("Son kiriting")
    .int("Butun son bo'lishi kerak")
    .min(1, "Kamida 1 kun")
    .nullable(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  email: z.string().trim().min(3, "Email kiriting").max(254),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const removeProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});
export type RemoveProjectMemberInput = z.infer<typeof removeProjectMemberSchema>;

export const transferProjectOwnerSchema = z.object({
  projectId: z.string().min(1),
  newOwnerId: z.string().min(1),
});
export type TransferProjectOwnerInput = z.infer<typeof transferProjectOwnerSchema>;
