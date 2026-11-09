import { describe, expect, it } from "vitest";
import { assetsService, MAX_ASSETS_PER_TEMPLATE } from "../src/modules/assets/assets.service";
import { callerFor, createUser } from "./factories";
import { solidPng } from "./png";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Assets project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "With assets" });
  const ids = { projectId: project.id, templateId: tpl.id };
  const template = (await owner.templates.get(ids)).template;
  return { owner, ids, template };
}

describe("assetsService", () => {
  it("uploads, lists (without storage key) and removes", async () => {
    const { owner, ids, template } = await setup();
    const a = await assetsService.upload(template, { name: "logo.png", bytes: solidPng(40, 20) });
    expect(a).toMatchObject({ name: "logo.png", kind: "image", width: 40, height: 20 });
    expect(a).not.toHaveProperty("storageKey");
    expect(await owner.templateAssets.list(ids)).toHaveLength(1);
    expect((await assetsService.forRender(template.id))[0]?.path).toContain(a.id);
    await owner.templateAssets.delete({ ...ids, assetId: a.id });
    expect(await owner.templateAssets.list(ids)).toHaveLength(0);
    expect((await fail(owner.templateAssets.delete({ ...ids, assetId: a.id })))?.code).toBe(
      "NOT_FOUND",
    );
  });

  it.each(["../x.png", "a/b.png", ".hidden.png", "", "a b.png", `${"a".repeat(70)}.png`])(
    "rejects name %j",
    async (name) => {
      const { template } = await setup();
      const e = await fail(assetsService.upload(template, { name, bytes: solidPng(2, 2) }));
      expect(e?.code).toBe("BAD_REQUEST");
    },
  );

  it("rejects duplicates, mismatched content, empty and oversized files", async () => {
    const { template } = await setup();
    await assetsService.upload(template, { name: "a.png", bytes: solidPng(2, 2) });
    expect(
      (await fail(assetsService.upload(template, { name: "a.png", bytes: solidPng(2, 2) })))?.code,
    ).toBe("CONFLICT");
    expect(
      (await fail(assetsService.upload(template, { name: "b.jpg", bytes: solidPng(2, 2) })))?.code,
    ).toBe("BAD_REQUEST");
    expect(
      (await fail(assetsService.upload(template, { name: "c.png", bytes: new Uint8Array(0) })))
        ?.code,
    ).toBe("BAD_REQUEST");
    const big = new Uint8Array(11 * 1024 * 1024);
    expect(
      (await fail(assetsService.upload(template, { name: "d.png", bytes: big })))?.message,
    ).toMatch(/MB/);
  });

  it("caps files per template", async () => {
    const { template } = await setup();
    const png = solidPng(2, 2);
    for (let i = 0; i < MAX_ASSETS_PER_TEMPLATE; i++) {
      await assetsService.upload(template, { name: `f${i}.png`, bytes: png });
    }
    expect(
      (await fail(assetsService.upload(template, { name: "extra.png", bytes: png })))?.code,
    ).toBe("BAD_REQUEST");
  });

  it("hides assets of other users' templates", async () => {
    const { ids } = await setup();
    const other = callerFor(await createUser());
    expect((await fail(other.templateAssets.list(ids)))?.code).toBe("NOT_FOUND");
  });
});
