import type { UpdateProfileInput } from "@documento/shared";
import { useMutation } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/entities/session";
import { authClient, queryClient } from "@/shared/api";
import { notify } from "@/shared/lib";

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { error } = await authClient.updateUser({ name: input.name });
      if (error) throw new Error("Ismni saqlab bo'lmadi");
    },
    onSuccess: async () => {
      // The sidebar and greeting read the name from the session query.
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
      notify.success("Profil saqlandi");
    },
    onError: (error) => notify.error(error.message),
  });
}
