import { z } from "zod";

export const API_KEY_RATE_MAX = 1000;
export const API_KEY_EXPIRY_MAX_DAYS = 3650;

export const createApiKeySchema = z
  .object({
    projectId: z.string().min(1),
    name: z.string().trim().min(2, "Kamida 2 ta belgi").max(100),
    scope: z.enum(["project", "templates"]),
    allowedTemplateIds: z.array(z.string().min(1)).max(100).optional(),
    rateLimitPerMin: z
      .number("Son kiriting")
      .int()
      .min(1, "Kamida 1")
      .max(API_KEY_RATE_MAX, `Ko'pi bilan ${API_KEY_RATE_MAX}`)
      .default(60),
    expiresInDays: z.number().int().min(1).max(API_KEY_EXPIRY_MAX_DAYS).nullable().default(null),
  })
  .refine((v) => v.scope !== "templates" || (v.allowedTemplateIds?.length ?? 0) > 0, {
    message: "Kamida bitta shablon tanlang",
    path: ["allowedTemplateIds"],
  });
export type CreateApiKeyInput = z.input<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
  projectId: z.string().min(1),
  apiKeyId: z.string().min(1),
});
