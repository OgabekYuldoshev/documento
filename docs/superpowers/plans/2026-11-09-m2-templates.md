# M2: Templates, versions, strict schema system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A project owner can create document templates with Typst source and a strict, builder-defined data schema, validate data against it, and publish immutable versions.

**Architecture:** The schema DSL (Zod-validated field tree), its JSON Schema compiler, sample generator and breaking-change diff live in `packages/shared` (pure, used by API and later by the web builder). The API adds `template`/`template_version` tables, `modules/templates` (router -> service -> repository) behind `projectProcedure` + a `templateProcedure`, and an Ajv-strict data validator. Web gets a templates list in the project page and a draft editor (source textarea, field builder, sample data, publish).

**Tech Stack:** Zod 4, Ajv 8 + ajv-formats, Drizzle/SQLite, tRPC 11, Vitest, React 19, Mantine 9.

**Spec:** `docs/superpowers/specs/2026-11-09-projects-templates-generation-design.md` (sections 3, 4, 7, 8, 10 M2). M1 plan: `docs/superpowers/plans/2026-11-09-m1-projects.md`.

## Global Constraints

- SQLite only; migrations via `pnpm db:generate`, committed. Router -> service -> repository layering. UI Uzbek (Latin) with straight `'`; code/commits English.
- Users never write raw JSON Schema. Allowed types: `string, number, integer, boolean, date, datetime, enum, image, array, object`. Max depth 5, max 200 fields total, serialized schema <= 64 KB, field names match `^[A-Za-z_][A-Za-z0-9_]{0,63}$` and are unique per level.
- Compiled JSON Schema is 2020-12 subset: no `$ref`, `patternProperties`, `if/then/else`, external `$schema`. Every object has `additionalProperties: false`. Validation: Ajv strict, `allErrors`, no type coercion.
- Draft is editable; published is immutable. Editing a published template = new draft copied from the current version. At most one draft per template (DB-enforced).
- Defaults: `renderTimeoutSec` 60 (1..300), `maxPayloadKb` 1024 (1..10240), source <= 512 KB.
- Every template procedure goes through `projectProcedure` then verifies the template belongs to that project (foreign/missing -> `NOT_FOUND`).
- Typst publish dry-run needs the runner (M3): in M2 `publish` validates schema + sampleData only, and exposes a single hook `publishChecks` in the service where M3 adds the compile check. Template assets are M3.

## Review Focus

1. **Hostile patterns:** `pattern` like `(a+)+$`, over 200 chars, or an invalid regex is rejected at schema save, never reaches Ajv. (Task 1)
2. **Name collisions:** duplicate field names, `__proto__`, `constructor` as field names are rejected. (Task 1)
3. **Extra/missing data:** unknown key, wrong type (`"5"` for number), missing required, nested array item errors each yield an error with a JSON-pointer `path` and Uzbek message; never throws on `null`/array/string root. (Task 2)
4. **Publish races/states:** publishing with no draft, publishing twice, saving to a published version, second draft creation all fail cleanly. (Task 4)
5. **Breaking changes:** removing a field, changing its type, or adding a required field is reported and publish needs `acknowledgeBreaking: true`. (Tasks 1, 4)

---

### Task 1: Schema DSL in shared (zod, compile, sample, diff)

**Files:**
- Create: `packages/shared/src/template-schema.ts`, `packages/shared/src/templates.schemas.ts`; export from `index.ts`
- Test: `apps/api/test/template-schema.test.ts` (API package hosts all tests)

**Interfaces:**
- Produces: `fieldDefSchema`, `templateSchemaSchema` (`{ fields: FieldDef[] }`, Zod, enforces all Global Constraints incl. pattern safety); types `FieldDef`, `TemplateSchema`; `toJsonSchema(schema: TemplateSchema): JsonSchemaObject`; `sampleFromSchema(schema): Record<string, unknown>`; `diffSchemas(prev: TemplateSchema, next: TemplateSchema): BreakingChange[]` (`{ path: string; kind: "removed"|"type_changed"|"required_added" }`).
- Produces (templates.schemas.ts): `createTemplateSchema {projectId,name,description?}`, `templateIdInput {projectId,templateId}`, `saveDraftSchema`, `publishSchema {projectId,templateId,acknowledgeBreaking?: boolean}`, `restoreVersionSchema {projectId,templateId,versionId}`; constants `DEFAULT_TEMPLATE_SOURCE`.

- [ ] Tests: valid builder schema compiles (object has `additionalProperties:false`, required list, `date` -> `format: date`, image -> string pattern `^upl_`); rejects `(a+)+$`, 201-char pattern, `[`, duplicate names, `__proto__`, depth 6, 201 fields; `sampleFromSchema` output has every required field with the right type; `diffSchemas` reports removed/type_changed/required_added and nothing for an additive optional field.
- [ ] Implement; run `pnpm test`; commit `feat(shared): add strict template schema DSL`.

### Task 2: Data validator (Ajv strict)

**Files:** Create `apps/api/src/modules/templates/validate-data.ts`; test `apps/api/test/validate-data.test.ts`.

**Interfaces:**
- Consumes: `toJsonSchema` (Task 1).
- Produces: `validateData(schema: TemplateSchema, data: unknown, opts?: { maxPayloadBytes?: number }): { ok: true; data: Record<string, unknown> } | { ok: false; errors: { path: string; code: string; message: string }[] }`. Compiled validators cached by schema checksum. Payload over the limit -> single error `code: "payload_too_large"`.

- [ ] Tests per Review Focus 3 (unknown key, `"5"` for number, missing required, `items/0/price`, root `null`/`[]`/`"x"`, enum miss, over-limit payload).
- [ ] Implement with Ajv (`strict`, `allErrors`, `coerceTypes:false`, `ajv-formats`, custom keyword `x-image`); commit `feat(api): add strict data validator`.

### Task 3: Tables, migration, repository

**Files:** Create `apps/api/src/db/schema/templates.ts` (+ export), generated migration, `modules/templates/templates.repository.ts`; test `apps/api/test/templates.schema.test.ts`.

**Interfaces:**
- Produces tables `template` (id, projectId FK cascade-free restrict, slug, name, description, currentVersionId nullable, archivedAt, timestamps; unique `(projectId, slug)`) and `template_version` (id, templateId FK, number, status `draft|published|archived`, source, schema JSON, sampleData JSON, renderTimeoutSec, maxPayloadKb, publishedAt, publishedBy, checksum, timestamps; unique `(templateId, number)`; partial unique index on `templateId` where `status='draft'`). Repository: `insertTemplate`, `findTemplate(id)`, `listByProject(projectId)`, `slugExists(projectId, slug)`, `insertVersion`, `findVersion(id)`, `findDraft(templateId)`, `findCurrent(templateId)`, `listVersions(templateId)`, `updateVersion(id, patch)`, `setCurrent(templateId, versionId)`, `archiveTemplate(id)`, `nextNumber(templateId)`.

- [ ] Tests: duplicate slug in same project rejected, allowed in other project; second draft rejected; duplicate version number rejected.
- [ ] `pnpm db:generate`, apply with `pnpm db:setup`; commit `feat(api): add template and version tables`.

### Task 4: Service + router

**Files:** Create `templates.service.ts`, `template-procedure.ts`, `templates.router.ts`; modify `app-router.ts`; test `apps/api/test/templates.service.test.ts`, `templates.router.test.ts`.

**Interfaces:**
- Produces `templateProcedure` = `projectProcedure.input(z.object({ templateId: z.string().min(1) }))` loading the template into `ctx.template`, `NOT_FOUND` when it belongs to another project or is archived. Router `templates`: `list`, `create`, `get` (template + current version summary + hasDraft), `getDraft` (creates draft from current published, or returns existing), `saveDraft`, `publish`, `versions`, `restoreVersion` (copies a version into the draft, replacing it), `archive`. `publish` returns `{ version, breaking: BreakingChange[] }`; when breaking changes exist and `acknowledgeBreaking` is not true it throws `CONFLICT` with the list in the message and does not publish. Service exposes `publishChecks(version): Promise<void>` (no-op in M2; M3 adds dry-run).

- [ ] Tests (Review Focus 4, 5 plus): foreign project's template -> `NOT_FOUND`; new template has draft v1 with starter source; `saveDraft` rejects invalid schema and source > 512 KB (sampleData is only enforced at publish, so the builder can be edited freely); `publish` marks v1 published, sets current, archives previous published on v2; publish with no draft fails; save after publish fails (no draft) until `getDraft` makes v2; second `getDraft` returns same draft; checksum stable for equal content.
- [ ] Implement; `pnpm test && pnpm check-types`; commit `feat(api): add templates module with versioning and publish`.

### Task 5: Web - templates list and draft editor

**Files:** Create `entities/template`, `features/templates/{create-template,save-draft,publish-template}`, `widgets/schema-builder`, `pages/template` (editor), templates tab in `pages/project`; routes `ROUTES.template(projectId, templateId)`.

**Interfaces:** Consumes `trpc.templates.*`, shared schemas (Task 1/4). Editor: name, source `Textarea` (monospace; CodeMirror is M3), recursive field builder (add/remove/reorder field, type select, per-type constraints, required), sample data JSON textarea with "Schemadan namuna" button (`sampleFromSchema`), Save, Publish (breaking-change confirm dialog), version history list with restore.

- [ ] Implement per CLAUDE.md FSD/DataTable/Uzbek rules; `pnpm check-types && pnpm lint`.
- [ ] Browser check: create template, add fields, save, publish, change field type, publish shows breaking warning; update `CLAUDE.md`; commit `feat(web): add templates tab and draft editor`.

---

## Self-Review

- **Spec coverage:** sections 3 (template, template_version; assets deferred to M3), 4 (DSL, layers 1-2, breaking warning; layer 3 dry-run deferred to M3 via `publishChecks`), 7 (`templates.*`; `testGenerate` and `templateAssets` are M3), 8 (editor without CodeMirror/preview, M3).
- **Types:** `TemplateSchema`/`BreakingChange` (T1) used by T2, T4, T5; `templateProcedure` (T4) is what M3 imports.
- **Proportion:** logic-heavy tasks (1, 2, 4) are tested; web verified manually as in M1.
