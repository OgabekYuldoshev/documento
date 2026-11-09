import { isAdminRole } from "@documento/shared";
import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "./session.queries";

export function useSession() {
  const { data: user } = useQuery(sessionQueryOptions());
  return {
    user,
    isAdmin: isAdminRole(user?.role),
    isSuperadmin: user?.role === "superadmin",
  };
}
