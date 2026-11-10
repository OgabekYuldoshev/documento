import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { collectImages, type TemplateSchema } from "@documento/shared";
import { env } from "../../config/env";
import type { Project } from "../../db/schema";
import { AssetError, inspectContent } from "../assets/inspect";
import { storage } from "../storage/storage";
import { uploadsRepository as repo } from "./uploads.repository";

const MB = 1024 * 1024;
const HEADER_BYTES = 1 * MB; // enough for PNG IHDR and JPEG SOF (after EXIF)
const SVG_MAX_BYTES = 5 * MB;

/** Carries an HTTP-friendly status so the route can answer with a problem document. */
export class UploadError extends Error {
  constructor(
    readonly status: 400 | 413,
    readonly type: string,
    message: string,
  ) {
    super(message);
  }
}

export const uploadKey = (id: string) => `uploads/${id}`;

async function readHead(path: string, length: number): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export type ResolvedImages =
  | { ok: true; files: Map<string, { ext: string; path: string }> }
  | { ok: false; errors: { path: string; code: string; message: string }[] };

const EXT = { png: "png", jpeg: "jpg", svg: "svg" } as const;

export const uploadsService = {
  /**
   * Looks up every image id in schema-valid data (same project, not expired) and checks the field
   * constraints. Failures are shaped like validation errors so callers can report them as such.
   */
  async resolveImages(
    projectId: string,
    schema: TemplateSchema,
    data: unknown,
    opts: { extend?: boolean } = {},
  ): Promise<ResolvedImages> {
    const refs = collectImages(schema, data);
    if (refs.length === 0) return { ok: true, files: new Map() };
    const rows = await repo.findUsable(projectId, [...new Set(refs.map((r) => r.id))]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const errors: { path: string; code: string; message: string }[] = [];
    for (const { path, id, field } of refs) {
      const row = byId.get(id);
      if (!row) {
        errors.push({
          path,
          code: "image_not_found",
          message: "Rasm topilmadi yoki muddati o'tgan",
        });
        continue;
      }
      if (field.formats && !field.formats.includes(row.format)) {
        errors.push({
          path,
          code: "image_format",
          message: `Ruxsat etilgan formatlar: ${field.formats.join(", ")}`,
        });
      } else if (field.maxSizeMb !== undefined && row.size > field.maxSizeMb * MB) {
        errors.push({
          path,
          code: "image_size",
          message: `Rasm ${field.maxSizeMb} MB dan oshmasin`,
        });
      } else if (
        field.maxMegapixels !== undefined &&
        row.width !== null &&
        row.height !== null &&
        row.width * row.height > field.maxMegapixels * 1_000_000
      ) {
        errors.push({
          path,
          code: "image_pixels",
          message: `Rasm ${field.maxMegapixels} megapikseldan oshmasin`,
        });
      }
    }
    if (errors.length > 0) return { ok: false, errors };
    if (opts.extend) {
      await repo.extend([...byId.keys()], new Date(Date.now() + 60 * 60_000));
    }
    return {
      ok: true,
      files: new Map(
        rows.map((r) => [r.id, { ext: EXT[r.format], path: storage.getPath(r.storageKey) }]),
      ),
    };
  },

  /**
   * Streams the request body to disk (never buffered), then validates by content:
   * format, pixel budget (<= 40 MP, read from the header), SVG sanity.
   */
  async receive(
    project: Project,
    /** Null for dashboard (session) uploads. */
    apiKeyId: string | null,
    body: ReadableStream | null,
    declared?: number,
  ) {
    const maxBytes = env.UPLOAD_MAX_MB * MB;
    if (!body) throw new UploadError(400, "empty_upload", "Fayl yuborilmagan");
    if (declared !== undefined && declared > maxBytes) {
      throw new UploadError(413, "payload_too_large", `Fayl ${env.UPLOAD_MAX_MB} MB dan oshmasin`);
    }
    const quota = env.UPLOAD_PROJECT_QUOTA_MB * MB;
    if ((await repo.activeBytes(project.id)) + (declared ?? 0) > quota) {
      throw new UploadError(
        413,
        "quota_exceeded",
        "Project uchun vaqtinchalik fayllar kvotasi to'ldi",
      );
    }

    const tmp = join(tmpdir(), `documento-upload-${randomBytes(8).toString("hex")}`);
    const hash = createHash("sha256");
    let size = 0;
    try {
      await pipeline(
        Readable.fromWeb(body as never),
        new Transform({
          transform(chunk: Buffer, _enc, cb) {
            size += chunk.length;
            if (size > maxBytes) {
              cb(
                new UploadError(
                  413,
                  "payload_too_large",
                  `Fayl ${env.UPLOAD_MAX_MB} MB dan oshmasin`,
                ),
              );
              return;
            }
            hash.update(chunk);
            cb(null, chunk);
          },
        }),
        createWriteStream(tmp),
      );
      if (size === 0) throw new UploadError(400, "empty_upload", "Fayl bo'sh");
      if ((await repo.activeBytes(project.id)) + size > quota) {
        throw new UploadError(
          413,
          "quota_exceeded",
          "Project uchun vaqtinchalik fayllar kvotasi to'ldi",
        );
      }

      let info: ReturnType<typeof inspectContent>;
      try {
        const head = await readHead(tmp, Math.min(size, HEADER_BYTES));
        info = inspectContent(head);
        if (info.kind !== "image")
          throw new AssetError("Faqat rasm yuklash mumkin (png, jpg, svg)");
        if (info.format === "svg") {
          if (size > SVG_MAX_BYTES) throw new AssetError("SVG 5 MB dan oshmasin");
          inspectContent(await readHead(tmp, size)); // full-text checks (ENTITY)
        }
      } catch (error) {
        if (error instanceof AssetError) throw new UploadError(400, "invalid_image", error.message);
        throw error;
      }

      const id = `upl_${randomBytes(12).toString("hex")}`;
      await storage.putFile(uploadKey(id), tmp);
      const row = await repo.insert({
        id,
        projectId: project.id,
        apiKeyId,
        format: info.format as "png" | "jpeg" | "svg",
        mime: info.mime,
        size: (await stat(tmp)).size,
        sha256: hash.digest("hex"),
        width: info.width ?? null,
        height: info.height ?? null,
        storageKey: uploadKey(id),
        expiresAt: new Date(Date.now() + env.UPLOAD_TTL_MINUTES * 60_000),
      });
      return {
        uploadId: row.id,
        mime: row.mime,
        bytes: row.size,
        width: row.width,
        height: row.height,
        expiresAt: row.expiresAt,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      // Transform errors surface wrapped by pipeline; unwrap ours.
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof UploadError) throw cause;
      throw error;
    } finally {
      await rm(tmp, { force: true });
    }
  },

  /** Deletes expired uploads (files + rows). Returns how many were removed. */
  async cleanExpired(now = new Date()): Promise<number> {
    const rows = await repo.expired(now);
    for (const row of rows) {
      await storage.remove(row.storageKey);
      await repo.remove(row.id);
    }
    return rows.length;
  },
};

/** Boot hook: sweep every 10 minutes. */
export function startUploadCleaner() {
  const timer = setInterval(() => {
    uploadsService.cleanExpired().catch((e) => console.error("[uploads] cleanup failed", e));
  }, 10 * 60_000);
  timer.unref();
}
