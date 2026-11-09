import {
  ActionIcon,
  Avatar,
  Burger,
  Group,
  AppShell as MantineAppShell,
  Menu,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconFileText, IconLayoutDashboard, IconUsers } from "@tabler/icons-react";
import { Outlet, NavLink as RouterLink } from "react-router";
import { useSession } from "@/entities/session";
import { UserRoleBadge } from "@/entities/user";
import { LogoutMenuItem } from "@/features/auth/logout";
import { ColorSchemeToggle } from "@/features/theme/toggle-color-scheme";
import { ROUTES } from "@/shared/config";
import { getInitials } from "@/shared/lib";

const NAV = [
  { to: ROUTES.dashboard, label: "Dashboard", icon: IconLayoutDashboard, adminOnly: false },
  { to: ROUTES.users, label: "Users", icon: IconUsers, adminOnly: true },
];

export function AppShell() {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, isAdmin } = useSession();

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon size={34} radius="md">
              <IconFileText size={20} />
            </ThemeIcon>
            <Text fw={700} fz="lg">
              Documento
            </Text>
          </Group>
          <Group gap="sm">
            <ColorSchemeToggle />
            <Menu position="bottom-end" width={220} shadow="md">
              <Menu.Target>
                <ActionIcon variant="transparent" radius="xl" size={38} aria-label="Account">
                  <Avatar color="initials" name={user?.name} radius="xl" size={36}>
                    {user ? getInitials(user.name) : null}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap={4} p="xs">
                  <Text fw={600} size="sm">
                    {user?.name}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {user?.email}
                  </Text>
                  {user && <UserRoleBadge role={user.role} />}
                </Stack>
                <Menu.Divider />
                <LogoutMenuItem />
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        <Stack gap={4}>
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              component={RouterLink}
              to={item.to}
              end={item.to === ROUTES.dashboard}
              label={item.label}
              leftSection={<item.icon size={18} />}
              onClick={close}
              variant="light"
              style={{ borderRadius: "var(--mantine-radius-md)" }}
            />
          ))}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
