import { Paper, Stack, Text, Title } from "@mantine/core";
import { useSession } from "@/entities/session";
import { PageHeader } from "@/shared/ui";
import { StatsGrid } from "@/widgets/stats-grid";

export function DashboardPage() {
  const { user, isAdmin } = useSession();
  const firstName = user?.name.split(" ")[0];

  return (
    <Stack gap="lg">
      <PageHeader title={`Welcome, ${firstName}`} description="Here is what's happening today." />
      {isAdmin ? (
        <StatsGrid />
      ) : (
        <Paper withBorder p="xl" radius="md">
          <Title order={4}>You're signed in</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Your workspace is being set up. More features are coming soon.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
