import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { resetSession } from "@/entities/session";
import { authClient } from "@/shared/api";
import { ROUTES } from "@/shared/config";

export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSettled: () => {
      resetSession();
      navigate(ROUTES.login, { replace: true });
    },
  });
}
