import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { env } from "../../config/env";
import { auth } from "../../lib/auth";
import { projectsService } from "../projects/projects.service";
import { templatesRepository } from "../templates/templates.repository";
import { assetsService } from "./assets.service";

const STATUS = { NOT_FOUND: 404, BAD_REQUEST: 400, CONFLICT: 409, FORBIDDEN: 403 } as const;

/** Multipart upload; tRPC is not suited to binary bodies. Same ownership rule as everywhere. */
export const assetsRoute = new Hono()
  .post(
    "/api/templates/:templateId/assets",
    bodyLimit({
      maxSize: env.ASSET_MAX_MB * 1024 * 1024 + 64 * 1024,
      onError: (c) => c.json({ message: "Fayl juda katta" }, 413),
    }),
    async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);
      const actor = { id: session.user.id, role: (session.user.role ?? "user") as Role };

      try {
        const template = await templatesRepository.findTemplate(c.req.param("templateId"));
        if (!template || template.archivedAt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Shablon topilmadi" });
        }
        await projectsService.get(actor, template.projectId);

        const body = await c.req.parseBody();
        const file = body.file;
        if (!(file instanceof File)) return c.json({ message: "Fayl yuborilmagan" }, 400);
        const name = typeof body.name === "string" && body.name ? body.name : file.name;
        const asset = await assetsService.upload(template, {
          name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        return c.json(asset, 201);
      } catch (error) {
        if (error instanceof TRPCError) {
          return c.json(
            { message: error.message },
            STATUS[error.code as keyof typeof STATUS] ?? 400,
          );
        }
        throw error;
      }
    },
  )
  .get("/api/templates/:templateId/assets/:assetId/file", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Tizimga kirmagansiz" }, 401);
    const actor = { id: session.user.id, role: (session.user.role ?? "user") as Role };

    try {
      const template = await templatesRepository.findTemplate(c.req.param("templateId"));
      if (!template || template.archivedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shablon topilmadi" });
      }
      await projectsService.get(actor, template.projectId);
      const file = await assetsService.file(template, c.req.param("assetId"));
      return new Response(Readable.toWeb(createReadStream(file.path)) as ReadableStream, {
        headers: {
          "Content-Type": file.mime,
          "Cache-Control": "private, max-age=300",
          // An SVG opened directly must not run scripts or load anything external.
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        },
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        return c.json({ message: error.message }, STATUS[error.code as keyof typeof STATUS] ?? 400);
      }
      throw error;
    }
  });
