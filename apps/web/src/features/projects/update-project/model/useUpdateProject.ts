import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateProjectQueries } from "../../invalidate";

export function useUpdateProject() {
  return useMutation({
    ...trpc.projects.update.mutationOptions(),
    onSuccess: async () => {
      await invalidateProjectQueries();
      notify.success("Saqlandi");
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });
}
