import { ActionIcon, Anchor, Box, Breadcrumbs, Group, Text, Tooltip } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { APP_HEADER_HEIGHT } from "@/shared/config";

type Props = {
  breadcrumbs: { label: string; to: string }[];
  title: string;
  /** Shown as a tooltip on the title (keeps the bar to a single row). */
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  /** Far right of the bar (e.g. the color scheme toggle, composed by the page). */
  endSlot?: ReactNode;
  /** Far left of the bar (e.g. the app sidebar toggle, composed by the page). */
  startSlot?: ReactNode;
  children: ReactNode;
};

/** Full-screen editor frame: a slim top bar with back link and actions, content below. */
export function WorkspaceFrame({
  breadcrumbs,
  title,
  description,
  badges,
  actions,
  endSlot,
  startSlot,
  children,
}: Props) {
  const back = breadcrumbs[breadcrumbs.length - 1];
  return (
    <Box h="100dvh" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Group
        component="header"
        justify="space-between"
        wrap="nowrap"
        gap="sm"
        h={APP_HEADER_HEIGHT}
        px="md"
        style={{
          flexShrink: 0,
          borderBottom: "1px solid var(--app-border)",
          background: "var(--app-surface)",
        }}
      >
        <Group gap="sm" wrap="nowrap" miw={0}>
          {startSlot}
          {back && (
            <Tooltip label={`${back.label}ga qaytish`}>
              <ActionIcon
                component={Link}
                to={back.to}
                variant="subtle"
                color="gray"
                size="lg"
                aria-label={`${back.label}ga qaytish`}
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <Breadcrumbs separator="/" separatorMargin={6} style={{ flexWrap: "nowrap" }}>
            {breadcrumbs.map((crumb) => (
              <Anchor key={crumb.to} component={Link} to={crumb.to} size="sm" c="dimmed">
                {crumb.label}
              </Anchor>
            ))}
            <Text fw={700} fz="md" lineClamp={1} title={description}>
              {title}
            </Text>
          </Breadcrumbs>
          {badges}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {actions}
          {endSlot}
        </Group>
      </Group>
      <Box p="sm" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {children}
      </Box>
    </Box>
  );
}
