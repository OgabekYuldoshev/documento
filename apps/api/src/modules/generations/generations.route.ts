import type { Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { auth } from "../../lib/auth";
import { generationsService } from "./generations.service";
import { pdfAvailability, streamPdf } from "./pdf-response";

/** Dashboard PDF download: session + project ownership enforced. API clients use `/v1`. */
export const generationsRoute = new Hono().get("/api/generations/:id/file", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);
  const actor = { id: session.user.id, role: (session.user.role ?? "user") as Role };

  try {
    const row = await generationsService.get(actor, c.req.param("id"));
    const state = pdfAvailability(row);
    if (state === "expired") {
      return c.json({ message: "PDF muddati o'tgan, qayta generatsiya qiling" }, 410);
    }
    if (state === "not_ready") return c.json({ message: "PDF tayyor emas" }, 404);
    // `?inline=1` lets the dashboard show the PDF in an iframe; default is a download.
    return await streamPdf(row, c.req.query("inline") === "1" ? "inline" : "attachment");
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return c.json({ message: error.message }, 404);
    }
    throw error;
  }
});
