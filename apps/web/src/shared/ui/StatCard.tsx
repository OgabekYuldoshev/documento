import { Group, Paper, Skeleton, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value?: number;
  icon: ReactNode;
  color?: string;
  loading?: boolean;
};

export function StatCard({ label, value, icon, color = "brand", loading }: StatCardProps) {
  return (
    <Paper withBorder p="lg" shadow="xs">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text c="dimmed" fw={600} fz="sm">
            {label}
          </Text>
          {loading ? (
            <Skeleton h={34} w={64} mt={8} />
          ) : (
            <Text fw={700} fz={32} lh={1.1} mt={8} style={{ letterSpacing: "-0.02em" }}>
              {value ?? 0}
            </Text>
          )}
        </div>
        <ThemeIcon variant="light" color={color} size={44} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
