import { Avatar, Menu, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconSelector } from "@tabler/icons-react";
import { useSession } from "@/entities/session";
import { UserRoleBadge } from "@/entities/user";
import { LogoutMenuItem } from "@/features/auth/logout";
import { getInitials } from "@/shared/lib";
import classes from "./sidebar-user-menu.module.scss";

export function SidebarUserMenu() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <Menu position="top-start" offset={8} width="target" shadow="lg">
      <Menu.Target>
        <UnstyledButton className={classes.trigger} aria-label="Account menu">
          <Avatar radius="xl" size={40}>
            {getInitials(user.name)}
          </Avatar>
          <div className={classes.info}>
            <Text size="sm" fw={600} lh={1.3} className={classes.ellipsis}>
              {user.name}
            </Text>
            <Text size="xs" c="dimmed" className={classes.ellipsis}>
              {user.role}
            </Text>
          </div>
          <IconSelector size={16} className={classes.chevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Stack gap={4} p="xs">
          <Text fw={600} size="sm">
            {user.name}
          </Text>
          <Text c="dimmed" size="xs">
            {user.email}
          </Text>
          <UserRoleBadge role={user.role} />
        </Stack>
        <Menu.Divider />
        <LogoutMenuItem />
      </Menu.Dropdown>
    </Menu>
  );
}
