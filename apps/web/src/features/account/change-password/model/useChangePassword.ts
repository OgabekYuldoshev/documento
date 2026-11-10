import type { ChangePasswordInput } from "@documento/shared";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/shared/api";
import { notify } from "@/shared/lib";

const ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "Joriy parol noto'g'ri",
  PASSWORD_TOO_SHORT: "Yangi parol juda qisqa (kamida 8 ta belgi)",
  PASSWORD_TOO_LONG: "Yangi parol juda uzun",
};

export function useChangePassword(onDone: () => void) {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { error } = await authClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOtherSessions,
      });
      if (error) throw new Error(ERRORS[error.code ?? ""] ?? "Parolni o'zgartirib bo'lmadi");
    },
    onSuccess: () => {
      notify.success("Parol o'zgartirildi");
      onDone();
    },
    onError: (error) => notify.error(error.message),
  });
}
