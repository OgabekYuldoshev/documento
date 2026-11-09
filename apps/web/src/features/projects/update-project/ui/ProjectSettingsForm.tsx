import { PROJECT_DESCRIPTION_MAX, updateProjectSchema } from "@documento/shared";
import { Button, Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
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
          <TextInput label="Nomi" required {...form.getInputProps("name")} />
          <Textarea
            label="Tavsif"
            autosize
            minRows={2}
            maxLength={PROJECT_DESCRIPTION_MAX}
            {...form.getInputProps("description")}
          />
          <Group gap="xl" align="flex-start">
            <TextInput
              label="Slug"
              description="Yaratilganda belgilanadi, o'zgarmaydi"
              value={project.slug}
              readOnly
              w={260}
            />
            <div>
              <Text size="sm" fw={500}>
                Yaratilgan
              </Text>
              <Text size="sm" c="dimmed" mt={6}>
                {formatDate(project.createdAt)}
              </Text>
            </div>
          </Group>
        </SettingsSection>

        <SettingsSection
          title="PDF saqlash"
          description="Yaratilgan PDF fayllar qancha vaqt saqlanishini belgilaydi. Muddat tugagach fayl o'chiriladi, yozuv tarixda qoladi."
        >
          <NumberInput
            label="Saqlash muddati (kun)"
            description="Bo'sh qoldirsangiz tizimdagi standart muddat ishlatiladi"
            placeholder="Standart"
            min={1}
            allowDecimal={false}
            allowNegative={false}
            w={260}
            {...form.getInputProps("retentionDays")}
          />
        </SettingsSection>

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
      </Stack>
    </form>
  );
}
