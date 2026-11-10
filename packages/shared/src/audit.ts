import { z } from "zod";

/** Every audited action with its UI label (Uzbek). Keys are stored in `audit_log.action`. */
export const AUDIT_ACTIONS = {
  "auth.login": "Tizimga kirdi",
  "auth.login_failed": "Kirish muvaffaqiyatsiz",
  "auth.login_blocked": "Kirish bloklandi (ko'p urinish)",
  "auth.password_changed": "Parolni o'zgartirdi",
  "user.created": "Foydalanuvchi yaratildi",
  "user.banned": "Foydalanuvchi bloklandi",
  "user.unbanned": "Foydalanuvchi blokdan chiqarildi",
  "user.removed": "Foydalanuvchi o'chirildi",
  "user.password_reset": "Parol tiklandi (admin)",
  "project.created": "Project yaratildi",
  "project.updated": "Project yangilandi",
  "project.archived": "Project arxivlandi",
  "project.deleted": "Project o'chirildi",
  "api_key.created": "API key yaratildi",
  "api_key.revoked": "API key bekor qilindi",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_ACTION_KEYS = Object.keys(AUDIT_ACTIONS) as [AuditAction, ...AuditAction[]];

export const getAuditActionLabel = (action: string) =>
  (AUDIT_ACTIONS as Record<string, string>)[action] ?? action;

export const listAuditSchema = z.object({
  action: z.enum(AUDIT_ACTION_KEYS).optional(),
  /** Free text matched against actor, target and detail. */
  search: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(1000).default(500),
});
export type ListAuditInput = z.infer<typeof listAuditSchema>;
