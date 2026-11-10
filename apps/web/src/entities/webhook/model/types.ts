import type { AppRouter } from "@documento/api";
import type { inferRouterOutputs } from "@trpc/server";

type Out = inferRouterOutputs<AppRouter>["webhooks"];
export type WebhookItem = NonNullable<Out["get"]>;
export type WebhookDeliveryItem = Out["deliveries"][number];
