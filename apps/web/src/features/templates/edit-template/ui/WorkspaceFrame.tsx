import { Anchor, Box, Breadcrumbs, Group, Tabs, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";

export type WorkspaceTab = {
  value: string;
  label: string;
  content: ReactNode;
  /** Content manages its own scrolling (editor panes); otherwise the panel scrolls. */
  fill?: boolean;
};

type Props = {
  breadcrumbs: { label: string; to: string }[];
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  tabs: WorkspaceTab[];
};

/** Full-height template workspace: compact header on top, tabbed content filling the rest. */
export function WorkspaceFrame({ breadcrumbs, title, description, badges, actions, tabs }: Props) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        // Viewport minus the app header and the shell's vertical padding.
        height:
          "calc(100dvh - var(--app-shell-header-height, 64px) - 2 * var(--mantine-spacing-lg))",
        minHeight: 640,
      }}
    >
      <Breadcrumbs mb={4}>
        {breadcrumbs.map((crumb) => (
          <Anchor key={crumb.to} component={Link} to={crumb.to} size="xs">
            {crumb.label}
          </Anchor>
        ))}
      </Breadcrumbs>

      <Group justify="space-between" align="center" wrap="wrap" mb="sm" gap="sm">
        <Box miw={0}>
          <Group gap="sm" wrap="nowrap">
            <Title order={3} lineClamp={1}>
              {title}
            </Title>
            {badges}
          </Group>
          {description && (
            <Text size="sm" c="dimmed" lineClamp={1}>
              {description}
            </Text>
          )}
        </Box>
        {actions}
      </Group>

      <Tabs
        defaultValue={tabs[0]?.value}
        keepMounted
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <Tabs.List mb="md">
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.value}
            value={tab.value}
            style={{ flex: 1, minHeight: 0, overflow: tab.fill ? "hidden" : "auto" }}
          >
            {tab.content}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Box>
  );
}
