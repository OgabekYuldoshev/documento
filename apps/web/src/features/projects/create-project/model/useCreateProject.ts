import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateProjectQueries } from "../../invalidate";

export function useCreateProject(onCreated?: (projectId: string) => void) {
  return useMutation({
    ...trpc.projects.create.mutationOptions(),
    onSuccess: async (project) => {
      await invalidateProjectQueries();
      notify.success("Project yaratildi");
      onCreated?.(project.id);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });
}
