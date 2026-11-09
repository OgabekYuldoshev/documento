import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";

export function useProjects() {
  return useQuery(trpc.projects.list.queryOptions());
}
