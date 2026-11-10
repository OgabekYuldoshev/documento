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

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Kamida 2 ta belgi").max(100, "Ko'pi bilan 100 ta belgi"),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Yangi parolni takrorlang"),
    /** Sign out every other device after the change. */
    revokeOtherSessions: z.boolean(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parollar mos kelmadi",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Yangi parol joriy paroldan farq qilsin",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
