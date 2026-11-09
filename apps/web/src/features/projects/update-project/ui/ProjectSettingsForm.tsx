import { PROJECT_DESCRIPTION_MAX, updateProjectSchema } from "@documento/shared";
import {
  Button,
  Collapse,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import type { Project } from "@/entities/project";
import { formatDate } from "@/shared/lib";
import { SettingsSection } from "@/shared/ui";
import { useUpdateProject } from "../model/useUpdateProject";

export function ProjectSettingsForm({ project }: { project: Project }) {
  const form = useForm<{ name: string; description: string; retentionDays: number | string }>({
    initialValues: {
      name: project.name,
      description: project.description ?? "",
      retentionDays: project.retentionDays ?? "",
    },
    validate: (values) =>
      zod4Resolver(updateProjectSchema)({
        projectId: project.id,
        name: values.name,
        description: values.description || null,
        retentionDays: values.retentionDays === "" ? null : values.retentionDays,
      }),
  });
  const update = useUpdateProject();
  const dirty = form.isDirty();

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        update.mutate({
          projectId: project.id,
          name: values.name,
          description: values.description || null,
          retentionDays: values.retentionDays === "" ? null : Number(values.retentionDays),
        }),
      )}
      noValidate
    >
      <Stack gap="md">
        <SettingsSection
          title="Umumiy ma'lumot"
          description="Project nomi va tavsifi ro'yxatlarda ko'rinadi."
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <TextInput
              label="Nomi"
              placeholder="Masalan: Buxgalteriya hujjatlari"
              required
              {...form.getInputProps("name")}
            />
            <TextInput label="Slug" placeholder="—" value={project.slug} readOnly disabled />
            <TextInput
              label="Yaratilgan"
              placeholder="—"
              value={formatDate(project.createdAt)}
              readOnly
              disabled
            />
          </SimpleGrid>
          <Textarea
            label="Tavsif"
            placeholder="Bu project nima uchun ishlatiladi?"
            autosize
            minRows={2}
            maxLength={PROJECT_DESCRIPTION_MAX}
            {...form.getInputProps("description")}
          />
        </SettingsSection>

        <SettingsSection
          title="PDF saqlash"
          description="Muddat tugagach PDF fayl o'chiriladi, yozuv tarixda qoladi."
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <NumberInput
              label="Saqlash muddati (kun)"
              description="Bo'sh bo'lsa, standart muddat"
              placeholder="Standart"
              min={1}
              allowDecimal={false}
              allowNegative={false}
              {...form.getInputProps("retentionDays")}
            />
          </SimpleGrid>
        </SettingsSection>

        {/* Appears only when something changed, so a pristine form has no dead buttons. */}
        <Collapse expanded={dirty}>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={!dirty || update.isPending}
              onClick={() => form.reset()}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={!dirty} loading={update.isPending}>
              Saqlash
            </Button>
          </Group>
        </Collapse>
      </Stack>
    </form>
  );
}
