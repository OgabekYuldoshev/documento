import { API_KEY_RATE_MAX } from "@documento/shared";
import {
  Alert,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconKey } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateApiKeyQueries } from "../../invalidate";

type FormValues = {
  name: string;
  scope: "project" | "templates";
  templateIds: string[];
  rateLimitPerMin: number | string;
  expiresInDays: number | string;
};

export function CreateApiKeyButton({ projectId }: { projectId: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [secret, setSecret] = useState<string | null>(null);
  const templates = useQuery({
    ...trpc.templates.list.queryOptions({ projectId }),
    enabled: opened,
  });

  const form = useForm<FormValues>({
    initialValues: {
      name: "",
      scope: "project",
      templateIds: [],
      rateLimitPerMin: 60,
      expiresInDays: "",
    },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Kamida 2 ta belgi" : null),
      templateIds: (v, values) =>
        values.scope === "templates" && v.length === 0 ? "Kamida bitta shablon tanlang" : null,
      rateLimitPerMin: (v) =>
        typeof v !== "number" || v < 1 || v > API_KEY_RATE_MAX
          ? `1 dan ${API_KEY_RATE_MAX} gacha`
          : null,
    },
  });

  const create = useMutation({
    ...trpc.apiKeys.create.mutationOptions(),
    onSuccess: async (res) => {
      await invalidateApiKeyQueries();
      form.reset();
      close();
      setSecret(res.secret);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      <Button leftSection={<IconKey size={18} />} onClick={open}>
        Yangi API key
      </Button>

      <Modal opened={opened} onClose={close} title="API key yaratish" centered>
        <form
          noValidate
          onSubmit={form.onSubmit((v) =>
            create.mutate({
              projectId,
              name: v.name,
              scope: v.scope,
              allowedTemplateIds: v.scope === "templates" ? v.templateIds : undefined,
              rateLimitPerMin: Number(v.rateLimitPerMin),
              expiresInDays: v.expiresInDays === "" ? null : Number(v.expiresInDays),
            }),
          )}
        >
          <Stack>
            <TextInput
              label="Nomi"
              placeholder="Masalan: ERP integratsiya"
              data-autofocus
              {...form.getInputProps("name")}
            />
            <div>
              <Text size="sm" fw={500} mb={4}>
                Doira
              </Text>
              <SegmentedControl
                fullWidth
                data={[
                  { value: "project", label: "Butun project" },
                  { value: "templates", label: "Tanlangan shablonlar" },
                ]}
                {...form.getInputProps("scope")}
              />
            </div>
            {form.values.scope === "templates" && (
              <MultiSelect
                label="Shablonlar"
                data={(templates.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                {...form.getInputProps("templateIds")}
              />
            )}
            <Group grow align="flex-start">
              <NumberInput
                label="Limit (so'rov/daqiqa)"
                min={1}
                max={API_KEY_RATE_MAX}
                allowDecimal={false}
                {...form.getInputProps("rateLimitPerMin")}
              />
              <NumberInput
                label="Muddati (kun)"
                placeholder="Cheksiz"
                min={1}
                allowDecimal={false}
                {...form.getInputProps("expiresInDays")}
              />
            </Group>
            <Button type="submit" loading={create.isPending}>
              Yaratish
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={secret !== null}
        onClose={() => setSecret(null)}
        title="API key yaratildi"
        centered
        closeOnClickOutside={false}
      >
        <Stack>
          <Alert color="yellow" variant="light">
            Key faqat hozir ko'rsatiladi. Uni nusxalab xavfsiz joyga saqlang: keyin qayta ko'rib
            bo'lmaydi.
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
