import type { LoginInput } from "@documento/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { sessionQueryOptions } from "@/entities/session";
import { authClient, queryClient } from "@/shared/api";
import { ROUTES } from "@/shared/config";

export function useLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { error } = await authClient.signIn.email(input);
      if (error) throw new Error(error.message || "Invalid email or password");
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
