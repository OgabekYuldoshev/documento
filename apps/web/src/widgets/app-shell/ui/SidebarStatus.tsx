import { Group, Indicator, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";

/** Render queue pulse: jobs in flight and failures in the last 24 h across the user's projects. */
export function SidebarStatus() {
  const { data } = useQuery({
    ...trpc.generations.activity.queryOptions(),
    // Poll fast while something runs, slowly when idle.
    refetchInterval: (query) => (query.state.data?.running ? 4_000 : 30_000),
  });
  if (!data) return null;

  const { running, failed } = data;
  const color = failed > 0 ? "red" : running > 0 ? "yellow" : "teal";
  const label =
    running > 0 ? `Render: ${running} ta jarayonda` : failed > 0 ? "Xatolar bor" : "Render tayyor";

  return (
    <Tooltip
      multiline
      w={220}
      label={`Jarayonda: ${running} · Oxirgi 24 soatda xato: ${failed}`}
      openDelay={300}
    >
      <Group gap={10} px="sm" pb="xs" wrap="nowrap">
        <Indicator color={color} size={8} processing={running > 0} position="middle-center">
          <span style={{ display: "block", width: 8, height: 8 }} />
        </Indicator>
        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
          {label}
        </Text>
        {failed > 0 && (
          <Text size="xs" c="red" fw={600}>
            {failed} xato
          </Text>
        )}
      </Group>
    </Tooltip>
  );
}
