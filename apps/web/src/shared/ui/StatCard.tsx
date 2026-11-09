import { Group, Paper, Skeleton, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value?: number;
  icon: ReactNode;
  color?: string;
  loading?: boolean;
};

export function StatCard({ label, value, icon, color = "indigo", loading }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
            {label}
          </Text>
          {loading ? (
            <Skeleton h={32} w={60} mt={4} />
          ) : (
            <Text fw={700} fz={28} lh={1.2} mt={4}>
              {value ?? 0}
            </Text>
          )}
        </div>
        <ThemeIcon variant="light" color={color} size={48} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
