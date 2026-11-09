import type { LoginInput } from "@documento/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { sessionQueryOptions } from "@/entities/session";
import { authClient, queryClient } from "@/shared/api";
import { ROUTES } from "@/shared/config";

const LOGIN_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email yoki parol noto'g'ri",
  BANNED_USER: "Hisobingiz bloklangan. Administratorga murojaat qiling",
};

export function useLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { error } = await authClient.signIn.email(input);
      if (error) {
        throw new Error(LOGIN_ERRORS[error.code ?? ""] ?? "Email yoki parol noto'g'ri");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
      const next = params.get("next");
      // Only allow same-app relative redirects.
      navigate(next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.dashboard, {
        replace: true,
      });
    },
  });
}
