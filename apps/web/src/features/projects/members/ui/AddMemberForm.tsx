import { addProjectMemberSchema } from "@documento/shared";
import { Button, Group, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconUserPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateMemberQueries } from "../model/invalidate";

/** Adds an existing user to the project by email (owner / superadmin only). */
export function AddMemberForm({ projectId }: { projectId: string }) {
  const form = useForm<{ email: string }>({
    initialValues: { email: "" },
    validate: (values) => zod4Resolver(addProjectMemberSchema)({ projectId, email: values.email }),
  });
  const add = useMutation({
    ...trpc.projectMembers.add.mutationOptions(),
    onSuccess: async () => {
      await invalidateMemberQueries();
      notify.success("A'zo qo'shildi");
      form.reset();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <form
      onSubmit={form.onSubmit((values) => add.mutate({ projectId, email: values.email }))}
      noValidate
    >
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <TextInput
          flex={1}
          placeholder="Foydalanuvchi emaili (ali@kompaniya.uz)"
          aria-label="Foydalanuvchi emaili"
          autoComplete="off"
          {...form.getInputProps("email")}
        />
        <Button type="submit" leftSection={<IconUserPlus size={18} />} loading={add.isPending}>
          Qo'shish
        </Button>
      </Group>
    </form>
  );
}
