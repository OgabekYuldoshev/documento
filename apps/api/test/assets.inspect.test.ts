import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetError, inspectAsset } from "../src/modules/assets/inspect";
import { createLocalStorage } from "../src/modules/storage/storage";

function png(width: number, height: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function jpeg(width: number, height: number) {
  // SOI, APP0 (len 16), SOF0
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

const fails = (name: string, bytes: Uint8Array) => {
  try {
    inspectAsset(name, bytes);
  } catch (e) {
    return e instanceof AssetError ? e.message : "other";
  }
  return null;
};

describe("inspectAsset", () => {
  it("reads png and jpeg dimensions", () => {
    expect(inspectAsset("a.png", png(800, 600))).toMatchObject({
      kind: "image",
      width: 800,
      height: 600,
    });
    expect(inspectAsset("a.jpg", jpeg(1200, 900))).toMatchObject({
      format: "jpeg",
      width: 1200,
      height: 900,
    });
  });

  it("accepts svg and fonts by magic bytes", () => {
    expect(
      inspectAsset("l.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).format,
    ).toBe("svg");
    expect(inspectAsset("f.ttf", Buffer.from([0, 1, 0, 0, 9, 9])).kind).toBe("font");
    expect(inspectAsset("f.otf", Buffer.from("OTTOxxxx")).kind).toBe("font");
  });

  it("rejects extension/content mismatch and unknown types", () => {
    expect(fails("a.png", jpeg(10, 10))).toMatch(/mos kelmaydi/);
    expect(fails("a.png", Buffer.from("not an image"))).toMatch(/mos kelmaydi/);
    expect(fails("a.exe", Buffer.from("MZ"))).toMatch(/formatlar/);
    expect(fails("noext", Buffer.from("x"))).toMatch(/formatlar/);
  });

  it("rejects a tiny file that declares more than 40 MP", () => {
    expect(fails("bomb.png", png(20000, 20000))).toMatch(/megapiksel/);
    expect(fails("bomb.jpg", jpeg(10000, 10000))).toMatch(/megapiksel/);
    expect(inspectAsset("ok.png", png(6000, 6000)).width).toBe(6000); // 36 MP
  });

  it("rejects svg entities", () => {
    expect(fails("x.svg", Buffer.from('<!DOCTYPE x [<!ENTITY a "b">]><svg/>'))).toMatch(/ENTITY/);
  });
});

describe("local storage", () => {
  const root = mkdtempSync(join(tmpdir(), "documento-storage-"));
  const storage = createLocalStorage(root);

  it("rejects traversal and absolute keys", () => {
    for (const key of ["../x", "a/../../x", "/etc/passwd", "", ".hidden", "a/./b"]) {
      expect(() => storage.getPath(key)).toThrow("invalid storage key");
    }
  });

  it("round-trips a blob", async () => {
    await storage.put("assets/t1/a", Buffer.from("hi"));
    expect(storage.getPath("assets/t1/a").startsWith(root)).toBe(true);
    await storage.remove("assets/t1/a");
  });
});
