import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { ROUTES } from "@/shared/config";

export function NotFoundPage() {
  return (
    <Center mih="60dvh">
      <Stack align="center" gap="xs">
        <Text c="indigo" fw={700} fz={64} lh={1}>
          404
        </Text>
        <Title order={3}>Sahifa topilmadi</Title>
        <Button component={Link} to={ROUTES.dashboard} mt="sm" variant="light">
          Bosh sahifaga qaytish
        </Button>
      </Stack>
    </Center>
  );
}
