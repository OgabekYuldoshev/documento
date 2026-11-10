import {
  Group,
  AppShell as MantineAppShell,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconFileText } from "@tabler/icons-react";
import { Fragment } from "react";
import { useSession } from "@/entities/session";
import { APP_HEADER_HEIGHT, ROUTES } from "@/shared/config";
import { getVisibleNavigation } from "../model/navigation";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarRecent } from "./SidebarRecent";
import { SidebarStatus } from "./SidebarStatus";
import { SidebarLink } from "./sidebar-link";
import { SidebarUserMenu } from "./sidebar-user-menu";

export function AppSidebar({ onNavigate }: { onNavigate: () => void }) {
  const { isAdmin } = useSession();

  return (
    <>
      <MantineAppShell.Section
        h={APP_HEADER_HEIGHT}
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

      <MantineAppShell.Section grow component={ScrollArea} type="auto" px="md" py="lg">
        <Stack gap={32}>
          {getVisibleNavigation(isAdmin).map((group) => (
            <SidebarGroup key={group.title ?? "main"} title={group.title}>
              {group.items.map((item) => (
                <Fragment key={item.to}>
                  <SidebarLink
                    to={item.to}
                    end={item.to === ROUTES.dashboard || item.to === ROUTES.projects}
                    label={item.label}
                    icon={<item.icon size={17} stroke={1.7} />}
                    onNavigate={onNavigate}
                  />
                  {item.to === ROUTES.projects && <SidebarProjects onNavigate={onNavigate} />}
                </Fragment>
              ))}
            </SidebarGroup>
          ))}
          <SidebarRecent onNavigate={onNavigate} />
        </Stack>
      </MantineAppShell.Section>

      <MantineAppShell.Section p="sm" style={{ borderTop: "1px solid var(--app-border)" }}>
        <SidebarStatus />
        <SidebarUserMenu />
      </MantineAppShell.Section>
    </>
  );
}
