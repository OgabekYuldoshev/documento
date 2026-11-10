import { Code, Paper, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { WebhookSettings } from "@/features/webhooks/webhook-settings";
import { trpc } from "@/shared/api";
import { DataTable } from "@/shared/ui";
import { useDeliveriesColumns } from "../model/use-deliveries-columns";

const POLL_MS = 5000;

const EXAMPLE = `POST <sizning URL>
X-Documento-Event: document.completed
X-Documento-Delivery: <hodisa id>
X-Documento-Signature: t=<unix vaqt>,v1=<hex>

{
  "id": "<hodisa id>",
  "type": "document.completed",   // yoki document.failed, ping
  "createdAt": "2026-11-10T09:00:00.000Z",
  "data": {
    "documentId": "…", "status": "ok", "pages": 3, "bytes": 48213,
    "template": { "id": "…", "slug": "invoice", "name": "Invoice" },
    "links": { "self": "/v1/documents/…", "file": "/v1/documents/…/file" }
  }
}`;

const VERIFY = `// Node.js: imzoni tekshirish
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // eski so'rov
  const mac = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === mac.length && timingSafeEqual(given, mac);
}`;

/** Project "Webhook" tab: setup, delivery log, and what receivers get. */
export function WebhookPanel({ projectId }: { projectId: string }) {
  const columns = useDeliveriesColumns(projectId);
  const { data, isPending, error } = useQuery({
    ...trpc.webhooks.deliveries.queryOptions({ projectId, limit: 200 }),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "pending" || d.status === "sending")
        ? POLL_MS
        : false,
  });

  return (
    <Stack gap="lg">
      <WebhookSettings projectId={projectId} />

      <Stack gap="xs">
        <Text fw={600}>Yuborishlar logi</Text>
        <DataTable
          columns={columns}
          data={data}
          getRowId={(d) => d.id}
          isLoading={isPending}
          error={error?.message}
          searchable={false}
          initialSorting={[{ id: "createdAt", desc: true }]}
          emptyTitle="Hozircha yuborish yo'q"
          emptyDescription="API orqali hujjat yaratilganda yoki sinov yuborilganda shu yerda ko'rinadi. Loglar 30 kun saqlanadi."
        />
        <Text size="xs" c="dimmed">
          2xx javob = muvaffaqiyat. Aks holda 1 daqiqa, 5 daqiqa, 30 daqiqa, 2 soat va 6 soatdan
          keyin qayta uriniladi (jami 6 marta), so'ng "Xato" bo'ladi va qo'lda qayta yuborish
          mumkin.
        </Text>
      </Stack>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Qabul qiluvchi uchun</Text>
          <Text size="sm" c="dimmed">
            Har so'rov HMAC-SHA256 bilan imzolanadi. Imzoni tekshiring va hodisa <Code>id</Code>{" "}
            bo'yicha takrorlarni e'tiborsiz qoldiring (qayta urinishlarda bir xil id yuboriladi).
          </Text>
          <Code block>{EXAMPLE}</Code>
          <Code block>{VERIFY}</Code>
        </Stack>
      </Paper>
    </Stack>
  );
}
