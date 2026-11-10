import type { WebhookDeliveryStatus } from "@documento/shared";

export const WEBHOOK_STATUS_META: Record<WebhookDeliveryStatus, { label: string; color: string }> =
  {
    pending: { label: "Navbatda", color: "gray" },
    sending: { label: "Yuborilmoqda", color: "blue" },
    success: { label: "Yuborildi", color: "teal" },
    failed: { label: "Xato", color: "red" },
  };
