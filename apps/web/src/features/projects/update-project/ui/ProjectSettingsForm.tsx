import { PROJECT_DESCRIPTION_MAX, updateProjectSchema } from "@documento/shared";
import { Button, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import type { Project } from "@/entities/project";
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
      <Stack maw={520}>
        <TextInput label="Nomi" {...form.getInputProps("name")} />
        <Textarea
          label="Tavsif"
          autosize
          minRows={2}
          maxLength={PROJECT_DESCRIPTION_MAX}
          {...form.getInputProps("description")}
        />
        <NumberInput
          label="PDF saqlash muddati (kun)"
          description="PDF fayllar shuncha kun saqlanadi. Bo'sh qoldirsangiz standart muddat ishlatiladi."
          placeholder="Standart"
          min={1}
          allowDecimal={false}
          allowNegative={false}
          {...form.getInputProps("retentionDays")}
        />
        <Button type="submit" loading={update.isPending} w="fit-content">
          Saqlash
        </Button>
      </Stack>
    </form>
  );
}
