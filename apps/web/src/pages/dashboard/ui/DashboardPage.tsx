import { Stack, Text, Title } from "@mantine/core";
import { useSession } from "@/entities/session";
import { PageHeader } from "@/shared/ui";
import { DashboardHome } from "@/widgets/dashboard-home";
import { StatsGrid } from "@/widgets/stats-grid";

export function DashboardPage() {
  const { user, isAdmin } = useSession();
  const firstName = user?.name.split(" ")[0];

  return (
    <Stack gap="xl">
      <Stack gap="lg">
        <PageHeader
          mb={0}
          title={`Xush kelibsiz, ${firstName}`}
          description="Bugungi holat va oxirgi hujjatlar."
        />
        <DashboardHome />
      </Stack>

      {isAdmin && (
        <Stack gap="sm">
          <Title order={4}>Foydalanuvchilar</Title>
          <Text size="sm" c="dimmed" mt={-8}>
            Tizim bo'yicha o'sish va umumiy ko'rsatkichlar (faqat adminlarga).
          </Text>
          <StatsGrid />
        </Stack>
      )}
    </Stack>
  );
}
