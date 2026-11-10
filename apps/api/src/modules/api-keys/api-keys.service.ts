import type { CreateApiKeyInput } from "@documento/shared";
import { createApiKeySchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import type { ApiKey, Project } from "../../db/schema";
import { auditService } from "../audit/audit.service";
import { projectsRepository } from "../projects/projects.repository";
import { templatesRepository } from "../templates/templates.repository";
import { usersRepository } from "../users/users.repository";
import { apiKeysRepository as repo } from "./api-keys.repository";
import { generateKey, hashMatches, parseKeyPrefix } from "./key-format";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60_000;

/** The hash never leaves the server. */
export const toPublicKey = ({ hash: _hash, ...rest }: ApiKey) => rest;

export type AuthResult =
  | { ok: true; key: ApiKey; project: Project }
  | { ok: false; reason: "missing" | "invalid" | "revoked" | "expired" };

export const apiKeysService = {
  list: async (project: Project) => (await repo.list(project.id)).map(toPublicKey),

  async create(actorId: string, project: Project, rawInput: CreateApiKeyInput) {
    const input = createApiKeySchema.parse(rawInput);
    let allowed: string[] | null = null;
    if (input.scope === "templates") {
      allowed = [...new Set(input.allowedTemplateIds)];
      for (const id of allowed) {
        const tpl = await templatesRepository.findTemplate(id);
        if (!tpl || tpl.projectId !== project.id || tpl.archivedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shablon topilmadi" });
        }
      }
    }
    const { raw, prefix, hash } = generateKey();
    const row = await repo.insert({
      id: crypto.randomUUID(),
      projectId: project.id,
      name: input.name,
      prefix,
      hash,
      scope: input.scope,
      allowedTemplateIds: allowed,
      rateLimitPerMin: input.rateLimitPerMin,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * DAY_MS) : null,
      createdBy: actorId,
    });
    await auditService.record({
      action: "api_key.created",
      actorId,
      targetType: "api_key",
      targetId: row.id,
      targetLabel: `${row.name} (${project.name})`,
    });
    // The only time the full key is ever returned.
    return { key: toPublicKey(row), secret: raw };
  },

  async revoke(actorId: string, project: Project, apiKeyId: string) {
    const row = await repo.find(project.id, apiKeyId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Key topilmadi" });
    if (!row.revokedAt) {
      await repo.revoke(row.id, new Date());
      await auditService.record({
        action: "api_key.revoked",
        actorId,
        targetType: "api_key",
        targetId: row.id,
        targetLabel: `${row.name} (${project.name})`,
      });
    }
  },

  /** Verifies a raw key. Unknown/malformed/wrong-secret all return the same `invalid`. */
  async authenticate(raw: string | null | undefined): Promise<AuthResult> {
    if (!raw) return { ok: false, reason: "missing" };
    const prefix = parseKeyPrefix(raw);
    if (!prefix) return { ok: false, reason: "invalid" };
    const key = await repo.findByPrefix(prefix);
    if (!key || !hashMatches(raw, key.hash)) return { ok: false, reason: "invalid" };
    if (key.revokedAt) return { ok: false, reason: "revoked" };
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: "expired" };
    }
    const project = await projectsRepository.findById(key.projectId);
    if (!project || project.archivedAt) return { ok: false, reason: "invalid" };
    // A blocked (or removed) owner must not keep integrations alive through old keys.
    const owner = await usersRepository.findById(project.ownerId);
    if (!owner || owner.banned) return { ok: false, reason: "invalid" };
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await repo.touch(key.id, new Date());
    }
    return { ok: true, key, project };
  },

  /** A key may use a template if it has project scope or lists it explicitly. */
  canUseTemplate: (key: ApiKey, templateId: string) =>
    key.scope === "project" || (key.allowedTemplateIds ?? []).includes(templateId),
};
