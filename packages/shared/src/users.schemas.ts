import { z } from "zod";
import { emailSchema, passwordSchema } from "./auth.schemas";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Kamida 2 ta belgi").max(100),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const userIdSchema = z.object({ id: z.string().min(1) });

export const setBannedSchema = z.object({
  id: z.string().min(1),
  banned: z.boolean(),
});
