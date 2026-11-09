import { z } from "zod";
import { templateSchemaSchema } from "./template-schema";

export const TEMPLATE_SOURCE_MAX_BYTES = 512 * 1024;
export const TEMPLATE_TIMEOUT_MAX_SEC = 300;
export const TEMPLATE_PAYLOAD_MAX_KB = 10_240;

export const DEFAULT_TEMPLATE_SOURCE = `#set page(paper: "a4", margin: 20mm)
#set text(font: "Inter", size: 11pt)

#let data = json("data.json")

= Hujjat

#data
`;

const id = z.string().min(1);

export const createTemplateSchema = z.object({
  projectId: id,
  name: z.string().trim().min(2, "Kamida 2 ta belgi").max(100),
  description: z.string().trim().max(500).optional(),
});

export const templateIdInput = z.object({ projectId: id, templateId: id });

export const saveDraftSchema = z.object({
  projectId: id,
  templateId: id,
  // Character cap here; the API re-checks the real UTF-8 byte size.
  source: z.string().max(TEMPLATE_SOURCE_MAX_BYTES, "Kod juda katta"),
  schema: templateSchemaSchema,
  sampleData: z.record(z.string(), z.unknown()),
  renderTimeoutSec: z.number().int().min(1).max(TEMPLATE_TIMEOUT_MAX_SEC),
  maxPayloadKb: z.number().int().min(1).max(TEMPLATE_PAYLOAD_MAX_KB),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const publishSchema = z.object({
  projectId: id,
  templateId: id,
  acknowledgeBreaking: z.boolean().optional(),
});

export const restoreVersionSchema = z.object({ projectId: id, templateId: id, versionId: id });
