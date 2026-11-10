import type { Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { auth } from "../../lib/auth";
import { projectsService } from "../projects/projects.service";
import { UploadError, uploadsService } from "./uploads.service";

/**
 * Dashboard image upload for the "generate document" form: raw binary body, session auth and the
 * same project ownership rule as everywhere. API clients use `POST /v1/uploads`.
 */
export const uploadsRoute = new Hono().post("/api/projects/:projectId/uploads", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);
  const actor = { id: session.user.id, role: (session.user.role ?? "user") as Role };

  try {
    const project = await projectsService.get(actor, c.req.param("projectId"));
    const length = Number(c.req.header("content-length"));
    const result = await uploadsService.receive(
      project,
      null,
      c.req.raw.body,
      Number.isFinite(length) && length > 0 ? length : undefined,
    );
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof UploadError) return c.json({ message: error.message }, error.status);
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return c.json({ message: error.message }, 404);
    }
    throw error;
  }
});
