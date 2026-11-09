export const ROLES = ["superadmin", "admin", "user"] as const;
export type Role = (typeof ROLES)[number];

/** Roles an actor is allowed to assign when creating users. */
export const ASSIGNABLE_ROLES = {
  superadmin: ["admin", "user"],
  admin: ["user"],
  user: [],
} as const satisfies Record<Role, readonly Role[]>;

export const ADMIN_ROLES = ["superadmin", "admin"] as const satisfies readonly Role[];

/** Display names (Uzbek) for roles. */
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  user: "Foydalanuvchi",
};

export const getRoleLabel = (role: string) => ROLE_LABELS[role as Role] ?? role;

export const isAdminRole = (role: string | null | undefined): role is "superadmin" | "admin" =>
  role === "superadmin" || role === "admin";
