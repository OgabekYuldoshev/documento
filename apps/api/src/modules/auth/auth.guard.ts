import type { MiddlewareHandler } from "hono";
import { env } from "../../config/env";
import { auth } from "../../lib/auth";
import { auditService } from "../audit/audit.service";
import { createLoginGuard } from "./login-guard";

export const loginGuard = createLoginGuard({
  maxFailures: env.LOGIN_MAX_FAILURES,
  windowMs: env.LOGIN_LOCKOUT_MINUTES * 60_000,
});
setInterval(() => loginGuard.prune(), 5 * 60_000).unref();

/** Behind the reverse proxy the first X-Forwarded-For hop is the client. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

const TOO_MANY = "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring";

async function readEmail(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : null;
  } catch {
    return null;
  }
}

/** Wraps `POST /api/auth/sign-in/email`: throttles failures and writes the audit trail. */
export const signInGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== "POST") return next();
  const email = await readEmail(c.req.raw);
  if (!email) return next();
  const ip = clientIp(c.req.raw.headers);

  const decision = loginGuard.check(email, ip);
  if (decision.blocked) {
    await auditService.record({
      action: "auth.login_blocked",
      actorLabel: email,
      detail: `${decision.retryAfterSec} soniyadan keyin qayta urinish mumkin`,
      ip,
    });
    return c.json({ code: "TOO_MANY_ATTEMPTS", message: TOO_MANY }, 429, {
      "Retry-After": String(decision.retryAfterSec),
    });
  }

  await next();

  if (c.res.status === 200) {
    loginGuard.success(email);
    const body = (await c.res
      .clone()
      .json()
      .catch(() => null)) as {
      user?: { id?: string; name?: string; email?: string };
    } | null;
    await auditService.record({
      action: "auth.login",
      actorId: body?.user?.id,
      actorLabel: body?.user ? `${body.user.name} <${body.user.email}>` : email,
      ip,
    });
  } else if (c.res.status !== 429) {
    loginGuard.fail(email, ip);
    await auditService.record({ action: "auth.login_failed", actorLabel: email, ip });
  }
};

/** Wraps `POST /api/auth/change-password`: throttles wrong current passwords, audits success. */
export const changePasswordGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== "POST") return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return next();
  const key = `pw:${session.user.id}`;
  const ip = clientIp(c.req.raw.headers);

  const decision = loginGuard.check(key, ip);
  if (decision.blocked) {
    return c.json({ code: "TOO_MANY_ATTEMPTS", message: TOO_MANY }, 429, {
      "Retry-After": String(decision.retryAfterSec),
    });
  }

  await next();

  if (c.res.status === 200) {
    loginGuard.success(key);
    await auditService.record({
      action: "auth.password_changed",
      actorId: session.user.id,
      targetType: "user",
      targetId: session.user.id,
      targetLabel: `${session.user.name} <${session.user.email}>`,
      ip,
    });
  } else if (c.res.status !== 429) {
    loginGuard.fail(key, ip);
  }
};
