import type { Role } from "@documento/shared";
import { Badge } from "@mantine/core";

const COLORS: Record<Role, string> = { superadmin: "grape", admin: "indigo", user: "gray" };

export function UserRoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="light" color={COLORS[role as Role] ?? "gray"} tt="capitalize">
      {role}
    </Badge>
  );
}
