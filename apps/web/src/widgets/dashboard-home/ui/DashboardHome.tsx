import { Alert, Button, Grid, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconFolderPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useProjects } from "@/entities/project";
import { CreateProjectButton } from "@/features/projects/create-project";
import { trpc } from "@/shared/api";
import { HomeStats } from "./HomeStats";
import { QuickAccess } from "./QuickAccess";
import { RecentDocuments } from "./RecentDocuments";

/** Home for every user: numbers, the latest documents and shortcuts. Admin extras live on the page. */
export function DashboardHome() {
  const projects = useProjects();
  const home = useQuery({
    ...trpc.dashboard.home.queryOptions(),
    // Faster while jobs run, otherwise a calm refresh.
    refetchInterval: (query) => (query.state.data?.activity.running ? 4_000 : 30_000),
  });

  if (projects.data && projects.data.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="xs" py="lg" maw={420} mx="auto" ta="center">
          <IconFolderPlus size={36} stroke={1.4} color="var(--mantine-color-dimmed)" />
          <Title order={4}>Birinchi project'ingizni yarating</Title>
          <Text size="sm" c="dimmed">
            Project shablonlar, API kalitlar va hujjatlarni bir joyga yig'adi. Keyin shablon yozib,
            hujjat yaratishingiz mumkin.
          </Text>
          <CreateProjectButton />
        </Stack>
      </Paper>
    );
  }

  if (home.error) {
    return (
      <Alert color="red" variant="light" title="Ma'lumotni yuklab bo'lmadi">
        <Group gap="sm">
          <Text size="sm">{home.error.message}</Text>
          <Button size="xs" variant="default" onClick={() => home.refetch()}>
            Qayta urinish
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <HomeStats activity={home.data?.activity} loading={home.isPending} />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <RecentDocuments items={home.data?.recent ?? []} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <QuickAccess projects={projects.data ?? []} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
