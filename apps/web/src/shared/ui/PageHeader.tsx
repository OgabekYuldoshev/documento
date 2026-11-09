import { Group, type GroupProps, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type PageHeaderProps = Omit<GroupProps, "title"> & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions, ...props }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" mb="lg" {...props}>
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}
      </Stack>
      {actions}
    </Group>
  );
}
