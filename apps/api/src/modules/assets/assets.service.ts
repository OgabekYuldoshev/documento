import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import type { Template, TemplateAsset } from "../../db/schema";
import { storage } from "../storage/storage";
import { assetsRepository as repo } from "./assets.repository";
import { AssetError, inspectAsset } from "./inspect";

export const ASSET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const MAX_ASSETS_PER_TEMPLATE = 50;

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

/** Public shape: the storage key never leaves the server. */
export const toPublicAsset = ({ storageKey: _key, ...rest }: TemplateAsset) => rest;

export const assetsService = {
  async list(template: Template) {
    return (await repo.list(template.id)).map(toPublicAsset);
  },

  async upload(template: Template, input: { name: string; bytes: Uint8Array }) {
    if (!ASSET_NAME_PATTERN.test(input.name)) {
      throw bad("Fayl nomi faqat lotin harf, raqam, '.', '_' va '-' dan iborat bo'lsin");
    }
    if (input.bytes.byteLength === 0) throw bad("Fayl bo'sh");
    if (input.bytes.byteLength > env.ASSET_MAX_MB * 1024 * 1024) {
      throw bad(`Fayl hajmi ${env.ASSET_MAX_MB} MB dan oshmasin`);
    }
    const existing = await repo.list(template.id);
    if (existing.length >= MAX_ASSETS_PER_TEMPLATE) {
      throw bad(`Bitta shablonda ko'pi bilan ${MAX_ASSETS_PER_TEMPLATE} ta fayl bo'lishi mumkin`);
    }
    if (existing.some((a) => a.name === input.name)) {
      throw new TRPCError({ code: "CONFLICT", message: "Bu nomdagi fayl allaqachon mavjud" });
    }

    let info: ReturnType<typeof inspectAsset>;
    try {
      info = inspectAsset(input.name, input.bytes);
    } catch (error) {
      if (error instanceof AssetError) throw bad(error.message);
      throw error;
    }

    const id = crypto.randomUUID();
    const storageKey = `assets/${template.id}/${id}`;
    await storage.put(storageKey, input.bytes);
    try {
      return toPublicAsset(
        await repo.insert({
          id,
          templateId: template.id,
          name: input.name,
          kind: info.kind,
          mime: info.mime,
          size: input.bytes.byteLength,
          sha256: createHash("sha256").update(input.bytes).digest("hex"),
          width: info.width ?? null,
          height: info.height ?? null,
          storageKey,
        }),
      );
    } catch (error) {
      await storage.remove(storageKey);
      throw error;
    }
  },

  async remove(template: Template, assetId: string) {
    const asset = await repo.find(template.id, assetId);
    if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Fayl topilmadi" });
    await repo.remove(asset.id);
    await storage.remove(asset.storageKey);
  },

  /** Files the Typst runner copies into the job directory. */
  async forRender(templateId: string) {
    return (await repo.list(templateId)).map((a) => ({
      name: a.name,
      kind: a.kind,
      path: storage.getPath(a.storageKey),
    }));
  },
};
