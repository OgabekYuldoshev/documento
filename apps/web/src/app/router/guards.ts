import { isAdminRole } from "@documento/shared";
import { redirect } from "react-router";
import { getSessionUser } from "@/entities/session";
import { ROUTES } from "@/shared/config";

/** Signed-in users only; remembers where they were headed. */
export async function requireAuth({ request }: { request: Request }) {
  const user = await getSessionUser();
  if (!user) {
    const url = new URL(request.url);
    const next = url.pathname + url.search;
    throw redirect(
      next === "/" ? ROUTES.login : `${ROUTES.login}?next=${encodeURIComponent(next)}`,
    );
  }
  return user;
}

export async function requireGuest() {
  if (await getSessionUser()) throw redirect(ROUTES.dashboard);
  return null;
}

export async function requireAdmin(args: { request: Request }) {
  const user = await requireAuth(args);
  if (!isAdminRole(user.role)) throw redirect(ROUTES.dashboard);
  return user;
}
