export const MAX_MEGAPIXELS = 40;

export type AssetKind = "image" | "font";
export type AssetInfo = {
  kind: AssetKind;
  format: "png" | "jpeg" | "svg" | "ttf" | "otf";
  mime: string;
  width?: number;
  height?: number;
};

export class AssetError extends Error {}

const EXTENSIONS: Record<string, AssetInfo["format"]> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  svg: "svg",
  ttf: "ttf",
  otf: "otf",
};
const MIME: Record<AssetInfo["format"], string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
};

function detect(bytes: Uint8Array): AssetInfo["format"] | null {
  const b = Buffer.from(bytes.subarray(0, 4096));
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
    b.toString("latin1", 0, 4) === "true"
  ) {
    return "ttf";
  }
  if (b.toString("latin1", 0, 4) === "OTTO") return "otf";
  const head = b.toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<") && head.includes("<svg")) return "svg";
  return null;
}

function pngSize(b: Buffer) {
  if (b.length < 24 || b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpegSize(b: Buffer) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0xff) {
      i++;
      continue;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** Validates an upload by content (not by trusting the name): format, pixel budget, SVG sanity. */
export function inspectAsset(fileName: string, bytes: Uint8Array): AssetInfo {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const expected = EXTENSIONS[ext];
  if (!expected) throw new AssetError("Ruxsat etilgan formatlar: png, jpg, svg, ttf, otf");
  const format = detect(bytes);
  if (!format || format !== expected) {
    throw new AssetError("Fayl mazmuni kengaytmasiga mos kelmaydi");
  }
  const kind: AssetKind = format === "ttf" || format === "otf" ? "font" : "image";
  const info: AssetInfo = { kind, format, mime: MIME[format] };

  if (format === "png" || format === "jpeg") {
    const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = format === "png" ? pngSize(buf) : jpegSize(buf);
    if (!size || size.width === 0 || size.height === 0) {
      throw new AssetError("Rasm o'lchamini o'qib bo'lmadi");
    }
    if ((size.width * size.height) / 1_000_000 > MAX_MEGAPIXELS) {
      throw new AssetError(`Rasm ${MAX_MEGAPIXELS} megapikseldan katta`);
    }
    info.width = size.width;
    info.height = size.height;
  }
  if (format === "svg") {
    const text = Buffer.from(bytes).toString("utf8");
    if (/<!ENTITY/i.test(text)) throw new AssetError("SVG ichida ENTITY ruxsat etilmagan");
  }
  return info;
}
