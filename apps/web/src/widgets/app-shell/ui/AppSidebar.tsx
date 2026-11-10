import {
  Group,
  AppShell as MantineAppShell,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconFileText } from "@tabler/icons-react";
import { Fragment } from "react";
import { NavLink as RouterLink } from "react-router";
import { useSession } from "@/entities/session";
import { ROUTES } from "@/shared/config";
import { getVisibleNavigation } from "../model/navigation";
import { ProjectsNavLink } from "./projects-nav-link";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarUserMenu } from "./sidebar-user-menu";

export const HEADER_HEIGHT = 64;

export function AppSidebar({ onNavigate }: { onNavigate: () => void }) {
  const { isAdmin } = useSession();

  return (
    <>
      <MantineAppShell.Section
        h={HEADER_HEIGHT}
        px="md"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <Group h="100%" gap="sm" wrap="nowrap">
          <ThemeIcon
            size={36}
            radius="md"
            variant="gradient"
            gradient={{ from: "brand.5", to: "brand.8", deg: 135 }}
          >
            <IconFileText size={20} />
          </ThemeIcon>
          <Text fw={700} fz="lg" style={{ letterSpacing: "-0.02em" }}>
            Documento
          </Text>
        </Group>
      </MantineAppShell.Section>

      <MantineAppShell.Section grow component={ScrollArea} type="auto" px="sm" py="md">
        <Stack gap="lg">
          {getVisibleNavigation(isAdmin).map((group) => (
            <Stack key={group.title ?? "main"} gap={2}>
              {group.title && (
                <Text
                  px="sm"
                  pb={4}
                  fz={11}
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  style={{ letterSpacing: "0.06em" }}
                >
                  {group.title}
                </Text>
              )}
              {group.items.map((item) => (
                <Fragment key={item.to}>
                  {item.to === ROUTES.projects ? (
                    <ProjectsNavLink
                      to={item.to}
                      label={item.label}
                      leftSection={<item.icon size={19} stroke={1.6} />}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <NavLink
                      component={RouterLink}
                      to={item.to}
                      end={item.to === ROUTES.dashboard}
                      label={item.label}
                      leftSection={<item.icon size={19} stroke={1.6} />}
                      onClick={onNavigate}
                    />
                  )}
                  {item.to === ROUTES.projects && <SidebarProjects onNavigate={onNavigate} />}
                </Fragment>
              ))}
            </Stack>
          ))}
        </Stack>
      </MantineAppShell.Section>

      <MantineAppShell.Section p="sm" style={{ borderTop: "1px solid var(--app-border)" }}>
        <SidebarUserMenu />
      </MantineAppShell.Section>
    </>
  );
}
