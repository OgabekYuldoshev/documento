import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Email manzili noto'g'ri"));

export const passwordSchema = z
  .string()
  .min(8, "Kamida 8 ta belgi")
  .max(128, "Ko'pi bilan 128 ta belgi");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Parolni kiriting"),
});
export type LoginInput = z.infer<typeof loginSchema>;
