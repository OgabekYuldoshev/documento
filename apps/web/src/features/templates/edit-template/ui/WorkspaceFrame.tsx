import { Anchor, Box, Breadcrumbs, Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";

export type WorkspaceTab = { value: string; label: string; content: ReactNode };

type Props = {
  breadcrumbs: { label: string; to: string }[];
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/** Full-height template workspace: compact header on top, content filling the rest. */
export function WorkspaceFrame({
  breadcrumbs,
  title,
  description,
  badges,
  actions,
  children,
}: Props) {
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

      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
