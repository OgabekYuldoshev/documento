import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { Hono } from "hono";
import { auth } from "../../lib/auth";
import { previewsService } from "./previews.service";

/** Editor preview pages: session + owner enforced, rendered by `templates.preview`. */
export const previewsRoute = new Hono().get("/api/previews/:id/:page", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);

  const page = Number.parseInt(c.req.param("page"), 10);
  const path = await previewsService.pagePath(session.user.id, c.req.param("id"), page);
  if (!path) return c.json({ message: "Preview topilmadi yoki muddati o'tgan" }, 404);

  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=900",
      // An SVG opened directly must not run anything or load anything external.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  });
});
