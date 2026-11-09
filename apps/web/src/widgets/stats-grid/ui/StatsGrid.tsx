import { SimpleGrid } from "@mantine/core";
import { IconShieldCheck, IconUserCheck, IconUserOff, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { StatCard } from "@/shared/ui";

export function StatsGrid() {
  const { data, isPending } = useQuery(trpc.dashboard.overview.queryOptions());
  const stats = data?.stats;

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
      <StatCard
        label="Jami foydalanuvchilar"
        value={stats?.total}
        icon={<IconUsers size={26} />}
        loading={isPending}
      />
      <StatCard
        label="Faol"
        value={stats?.active}
        icon={<IconUserCheck size={26} />}
        color="teal"
        loading={isPending}
      />
      <StatCard
        label="Bloklangan"
        value={stats?.banned}
        icon={<IconUserOff size={26} />}
        color="orange"
        loading={isPending}
      />
      <StatCard
        label="Adminlar"
        value={stats?.admins}
        icon={<IconShieldCheck size={26} />}
        color="grape"
        loading={isPending}
      />
    </SimpleGrid>
  );
}
