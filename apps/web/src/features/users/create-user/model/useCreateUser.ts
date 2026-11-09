import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateUserQueries } from "../../invalidate";

export function useCreateUser(onCreated?: () => void) {
  return useMutation({
    ...trpc.users.create.mutationOptions(),
    onSuccess: async () => {
      await invalidateUserQueries();
      notify.success("Foydalanuvchi qo'shildi");
      onCreated?.();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });
}
