import { Paper, Stack, Text, Title } from "@mantine/core";
import { useSession } from "@/entities/session";
import { PageHeader } from "@/shared/ui";
import { StatsGrid } from "@/widgets/stats-grid";

export function DashboardPage() {
  const { user, isAdmin } = useSession();
  const firstName = user?.name.split(" ")[0];

  return (
    <Stack gap="lg">
      <PageHeader
        title={`Xush kelibsiz, ${firstName}`}
        description="Bugungi holat bilan tanishing."
      />
      {isAdmin ? (
        <StatsGrid />
      ) : (
        <Paper withBorder p="xl" radius="md">
          <Title order={4}>Siz tizimdasiz</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Ish maydoningiz tayyorlanmoqda. Yangi imkoniyatlar tez orada qo'shiladi.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
