import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Generation } from "../../db/schema";
import { storage } from "../storage/storage";

export type PdfAvailability = "ok" | "expired" | "not_ready";

export function pdfAvailability(row: Generation): PdfAvailability {
  if (row.status === "expired" || (row.pdfExpiresAt && row.pdfExpiresAt < new Date())) {
    return "expired";
  }
  return row.status === "ok" && row.pdfKey ? "ok" : "not_ready";
}

/** Streams the stored PDF from disk (never buffered). Caller must check `pdfAvailability` first. */
export async function streamPdf(
  row: Generation,
  disposition: "attachment" | "inline" = "attachment",
): Promise<Response> {
  const path = storage.getPath(row.pdfKey as string);
  const { size } = await stat(path);
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `${disposition}; filename="document-${row.id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Document-Id": row.id,
    },
  });
}
