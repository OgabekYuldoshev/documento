import { LineChart } from "@mantine/charts";
import { Badge, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { formatDay } from "@/shared/lib";

/** Admin overview: user growth over the last 30 days plus the headline counts. */
export function StatsGrid() {
  const { data, isPending } = useQuery(trpc.dashboard.overview.queryOptions());
  const stats = data?.stats;
  const growth = data?.growth.map((g) => ({
    date: formatDay(g.date),
    "Jami foydalanuvchilar": g.total,
    Yangi: g.new,
  }));

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text fw={600}>Foydalanuvchilar o'sishi</Text>
            <Text size="xs" c="dimmed">
              Oxirgi 30 kun
            </Text>
          </div>
          <Group gap="xs">
            <Badge variant="light" size="lg">
              Jami: {stats?.total ?? "–"}
            </Badge>
            <Badge variant="light" color="teal" size="lg">
              Faol: {stats?.active ?? "–"}
            </Badge>
            <Badge variant="light" color="orange" size="lg">
              Bloklangan: {stats?.banned ?? "–"}
            </Badge>
            <Badge variant="light" color="grape" size="lg">
              Adminlar: {stats?.admins ?? "–"}
            </Badge>
          </Group>
        </Group>

        {isPending || !growth ? (
          <Skeleton h={260} />
        ) : (
          <LineChart
            h={260}
            data={growth}
            dataKey="date"
            series={[
              { name: "Jami foydalanuvchilar", color: "brand.6" },
              { name: "Yangi", color: "teal.6" },
            ]}
            curveType="monotone"
            withLegend
            legendProps={{ verticalAlign: "bottom", height: 32 }}
            withDots={false}
            activeDotProps={{ r: 4 }}
            tickLine="x"
            gridAxis="xy"
            yAxisProps={{ allowDecimals: false, domain: [0, "dataMax + 1"] }}
            xAxisProps={{ interval: "preserveStartEnd", minTickGap: 28 }}
          />
        )}
      </Stack>
    </Paper>
  );
}
