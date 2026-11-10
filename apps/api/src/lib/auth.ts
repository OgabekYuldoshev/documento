import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { env, isProd } from "../config/env";
import { db, schema } from "../db/client";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by admins only.
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // No cookie cache: a ban, demotion or password reset must apply on the very next request.
  },
  advanced: {
    useSecureCookies: isProd,
    cookiePrefix: "documento",
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin", "superadmin"],
      roles: { user: userAc, admin: adminAc, superadmin: adminAc },
    }),
  ],
});

export type Auth = typeof auth;
