import { Group, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  /** Red border + title for destructive actions. */
  danger?: boolean;
  children: ReactNode;
};

/** Settings block: title/description on the left, controls on the right (stacks on mobile). */
export function SettingsSection({ title, description, danger, children }: SettingsSectionProps) {
  return (
    <Paper
      withBorder
      p="lg"
      radius="md"
      style={danger ? { borderColor: "var(--mantine-color-red-filled)" } : undefined}
    >
      <Group align="flex-start" gap="xl" wrap="wrap">
        <Stack gap={4} w={{ base: "100%", md: 260 }} style={{ flexShrink: 0 }}>
          <Text fw={600} c={danger ? "red" : undefined}>
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        <Stack gap="md" style={{ flex: 1, minWidth: 260 }}>
          {children}
        </Stack>
      </Group>
    </Paper>
  );
}
