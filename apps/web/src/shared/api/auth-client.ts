import { createAuthClient } from "better-auth/react";

/** Better Auth client: cookie-based session; endpoints live under /api/auth (proxied to the API). */
export const authClient = createAuthClient({ baseURL: window.location.origin });
