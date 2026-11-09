import { createProjectSchema, PROJECT_DESCRIPTION_MAX } from "@documento/shared";
import { Button, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useNavigate } from "react-router";
import { ROUTES } from "@/shared/config";
import { useCreateProject } from "../model/useCreateProject";

export function CreateProjectButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { name: "", description: "" },
    validate: zod4Resolver(createProjectSchema),
  });

  const create = useCreateProject((projectId) => {
    form.reset();
    close();
    navigate(ROUTES.project(projectId));
  });

  return (
    <>
      <Button leftSection={<IconPlus size={18} />} onClick={open}>
        Yangi project
      </Button>
      <Modal opened={opened} onClose={close} title="Project yaratish" centered>
        <form
          onSubmit={form.onSubmit((values) =>
            create.mutate({ name: values.name, description: values.description || undefined }),
          )}
          noValidate
        >
          <Stack>
            <TextInput label="Nomi" data-autofocus {...form.getInputProps("name")} />
            <Textarea
              label="Tavsif (ixtiyoriy)"
              autosize
              minRows={2}
              maxLength={PROJECT_DESCRIPTION_MAX}
              {...form.getInputProps("description")}
            />
            <Button type="submit" loading={create.isPending}>
              Yaratish
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
