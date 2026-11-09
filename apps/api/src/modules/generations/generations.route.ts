import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { auth } from "../../lib/auth";
import { storage } from "../storage/storage";
import { generationsService } from "./generations.service";

/** PDF download: streamed from disk (never buffered), session + project ownership enforced. */
export const generationsRoute = new Hono().get("/api/generations/:id/file", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);
  const actor = { id: session.user.id, role: (session.user.role ?? "user") as Role };

  try {
    const row = await generationsService.get(actor, c.req.param("id"));
    if (row.status === "expired" || (row.pdfExpiresAt && row.pdfExpiresAt < new Date())) {
      return c.json({ message: "PDF muddati o'tgan, qayta generatsiya qiling" }, 410);
    }
    if (row.status !== "ok" || !row.pdfKey) return c.json({ message: "PDF tayyor emas" }, 404);

    const path = storage.getPath(row.pdfKey);
    const { size } = await stat(path);
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="document-${row.id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return c.json({ message: error.message }, 404);
    }
    throw error;
  }
});
