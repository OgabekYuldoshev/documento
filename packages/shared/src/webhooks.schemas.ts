import { z } from "zod";

export const WEBHOOK_EVENTS = {
  "document.completed": "Hujjat tayyor",
  "document.failed": "Hujjat yaratilmadi",
  ping: "Sinov",
} as const;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "sending", "success", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

const projectId = z.string().min(1);

export const saveWebhookSchema = z.object({
  projectId,
  url: z
    .string()
    .trim()
    .max(500, "Ko'pi bilan 500 ta belgi")
    .pipe(z.url({ protocol: /^https?$/, error: "To'g'ri http(s) manzil kiriting" }))
    .refine((v) => !/\/\/[^/]*@/.test(v), "Manzilda login/parol bo'lmasin"),
  enabled: z.boolean(),
});
export type SaveWebhookInput = z.infer<typeof saveWebhookSchema>;

export const listWebhookDeliveriesSchema = z.object({
  projectId,
  status: z.enum(WEBHOOK_DELIVERY_STATUSES).optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export const retryWebhookDeliverySchema = z.object({
  projectId,
  deliveryId: z.string().min(1),
});
