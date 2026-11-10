import { SimpleGrid } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCalendarStats,
  IconFileCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { StatCard } from "@/shared/ui";

type Props = {
  activity?: { running: number; failed: number; last24h: number; last7d: number };
  loading: boolean;
};

/** Four numbers that answer "is everything fine and how much did we do". */
export function HomeStats({ activity, loading }: Props) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
      <StatCard
        label="Oxirgi 24 soat"
        value={activity?.last24h}
        icon={<IconFileCheck size={26} />}
        loading={loading}
      />
      <StatCard
        label="Oxirgi 7 kun"
        value={activity?.last7d}
        icon={<IconCalendarStats size={26} />}
        color="grape"
        loading={loading}
      />
      <StatCard
        label="Jarayonda"
        value={activity?.running}
        icon={<IconLoader2 size={26} />}
        color="blue"
        loading={loading}
      />
      <StatCard
        label="Xatolar (24 soat)"
        value={activity?.failed}
        icon={<IconAlertTriangle size={26} />}
        color={activity && activity.failed > 0 ? "red" : "teal"}
        loading={loading}
      />
    </SimpleGrid>
  );
}
