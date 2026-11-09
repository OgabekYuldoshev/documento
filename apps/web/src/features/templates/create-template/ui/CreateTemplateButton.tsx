import { createTemplateSchema } from "@documento/shared";
import { Button, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { zod4Resolver } from "mantine-form-zod-resolver";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { getErrorMessage, queryClient, trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { notify } from "@/shared/lib";

type CreateTemplateButtonProps = {
  projectId: string;
  /** Custom trigger (e.g. a gallery tile). Defaults to the primary button. */
  renderTrigger?: (open: () => void) => ReactNode;
};

export function CreateTemplateButton({ projectId, renderTrigger }: CreateTemplateButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { name: "", description: "" },
    validate: zod4Resolver(createTemplateSchema.omit({ projectId: true })),
  });

  const create = useMutation({
    ...trpc.templates.create.mutationOptions(),
    onSuccess: async (template) => {
      await queryClient.invalidateQueries(trpc.templates.pathFilter());
      notify.success("Shablon yaratildi");
      form.reset();
      close();
      navigate(ROUTES.template(projectId, template.id));
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <>
      {renderTrigger ? (
        renderTrigger(open)
      ) : (
        <Button leftSection={<IconPlus size={18} />} onClick={open}>
          Yangi shablon
        </Button>
      )}
      <Modal opened={opened} onClose={close} title="Shablon yaratish" centered>
        <form
          onSubmit={form.onSubmit((v) =>
            create.mutate({ projectId, name: v.name, description: v.description || undefined }),
          )}
          noValidate
        >
          <Stack>
            <TextInput
              label="Nomi"
              placeholder="Masalan: Shartnoma"
              data-autofocus
              {...form.getInputProps("name")}
            />
            <Textarea
              label="Tavsif (ixtiyoriy)"
              placeholder="Shablon qaysi hujjat uchun?"
              autosize
              minRows={2}
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
