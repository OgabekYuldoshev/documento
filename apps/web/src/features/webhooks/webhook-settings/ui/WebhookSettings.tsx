import { saveWebhookSchema } from "@documento/shared";
import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconKey, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { ConfirmModal, SettingsSection } from "@/shared/ui";
import { invalidateWebhookQueries } from "../../invalidate";

const formSchema = saveWebhookSchema.omit({ projectId: true });

type Props = { projectId: string };

/** URL + on/off, the signing secret (shown once) and a "send test" action. */
export function WebhookSettings({ projectId }: Props) {
  const { data: hook, isPending } = useQuery(trpc.webhooks.get.queryOptions({ projectId }));
  const [secret, setSecret] = useState<string | null>(null);
  const [rotateOpen, rotate] = useDisclosure(false);

  const form = useForm({
    initialValues: { url: "", enabled: true },
    validate: zod4Resolver(formSchema),
  });
  // Load saved values into the form once.
  const [loaded, setLoaded] = useState(false);
  if (hook && !loaded) {
    form.setValues({ url: hook.url, enabled: hook.enabled });
    form.resetDirty({ url: hook.url, enabled: hook.enabled });
    setLoaded(true);
  }

  const save = useMutation({
    ...trpc.webhooks.save.mutationOptions(),
    onSuccess: async (res, vars) => {
      form.resetDirty({ url: vars.url, enabled: vars.enabled });
      await invalidateWebhookQueries();
      notify.success("Webhook saqlandi");
      if (res.secret) setSecret(res.secret);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const rotateSecret = useMutation({
    ...trpc.webhooks.rotateSecret.mutationOptions(),
    onSuccess: async (res) => {
      await invalidateWebhookQueries();
      rotate.close();
      setSecret(res.secret);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const test = useMutation({
    ...trpc.webhooks.test.mutationOptions(),
    onSuccess: async (res) => {
      await invalidateWebhookQueries();
      if (res.status === "success") notify.success(`Sinov yuborildi (HTTP ${res.lastStatusCode})`);
      else notify.error(`Sinov yetib bormadi: ${res.lastError ?? "noma'lum xato"}`);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <form noValidate onSubmit={form.onSubmit((values) => save.mutate({ projectId, ...values }))}>
        <SettingsSection
          title="Webhook"
          description="Hujjat tayyor bo'lganda yoki yaratilmaganda shu manzilga POST yuboriladi (faqat API orqali yaratilgan hujjatlar uchun)."
        >
          <TextInput
            label="Manzil (URL)"
            placeholder="https://tizimingiz.uz/documento-webhook"
            description="Ichki tarmoq manzillari (localhost, 10.x, 192.168.x) ruxsat etilmaydi."
            disabled={isPending}
            {...form.getInputProps("url")}
          />
          <Switch
            label="Yoqilgan"
            disabled={isPending}
            {...form.getInputProps("enabled", { type: "checkbox" })}
          />
          {hook && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Imzo siri:
              </Text>
              <Code>{`whsec_…${hook.secretHint}`}</Code>
              <Button
                variant="subtle"
                size="compact-sm"
                leftSection={<IconKey size={14} />}
                onClick={rotate.open}
              >
                Almashtirish
              </Button>
            </Group>
          )}
          <Group justify="space-between">
            <Button
              variant="default"
              leftSection={<IconSend size={16} />}
              disabled={!hook || form.isDirty()}
              loading={test.isPending}
              onClick={() => test.mutate({ projectId })}
            >
              Sinov yuborish
            </Button>
            <Group gap="xs">
              {form.isDirty() && (
                <Badge variant="light" color="yellow">
                  Saqlanmagan
                </Badge>
              )}
              <Button type="submit" loading={save.isPending} disabled={!form.isDirty()}>
                Saqlash
              </Button>
            </Group>
          </Group>
        </SettingsSection>
      </form>

      <ConfirmModal
        opened={rotateOpen}
        onClose={rotate.close}
        title="Sirni almashtirish"
        message="Eski sir darhol ishlamay qoladi. Qabul qiluvchi tizimda yangi sirni o'rnatmaguningizcha imzo tekshiruvi o'tmaydi."
        confirmLabel="Almashtirish"
        loading={rotateSecret.isPending}
        onConfirm={() => rotateSecret.mutate({ projectId })}
      />

      <Modal
        opened={secret !== null}
        onClose={() => setSecret(null)}
        title="Imzo siri"
        centered
        closeOnClickOutside={false}
      >
        <Stack>
          <Alert color="yellow" variant="light">
            Sir faqat hozir ko'rsatiladi. Uni qabul qiluvchi tizimga o'rnating: keyin qayta ko'rib
            bo'lmaydi (yo'qolsa, almashtirasiz).
          </Alert>
          <Code block style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
            {secret}
          </Code>
          <Group justify="flex-end">
            <CopyButton value={secret ?? ""}>
              {({ copied, copy }) => (
                <Button variant="light" onClick={copy}>
                  {copied ? "Nusxalandi" : "Nusxalash"}
                </Button>
              )}
            </CopyButton>
            <Button onClick={() => setSecret(null)}>Tayyor</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
