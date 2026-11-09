import { Box, Center, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconFileText, IconShieldLock } from "@tabler/icons-react";
import { LoginForm } from "@/features/auth/login";
import { ColorSchemeToggle } from "@/features/theme/toggle-color-scheme";

export function LoginPage() {
  return (
    <Box style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Group wrap="nowrap" gap={0} align="stretch" style={{ minHeight: "100dvh" }}>
        <Box
          visibleFrom="md"
          p={64}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "white",
            background:
              "linear-gradient(135deg, var(--mantine-color-indigo-8), var(--mantine-color-violet-7))",
          }}
        >
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" variant="white" color="indigo">
              <IconFileText size={24} />
            </ThemeIcon>
            <Text fw={700} fz={22}>
              Documento
            </Text>
          </Group>
          <Stack gap="md" maw={460}>
            <Title order={1} fz={40} lh={1.15}>
              Your documents, organised and secure.
            </Title>
            <Text opacity={0.85}>Sign in with the account your administrator created for you.</Text>
          </Stack>
          <Group gap="xs" opacity={0.8}>
            <IconShieldLock size={18} />
            <Text size="sm">Access is invitation-only</Text>
          </Group>
        </Box>

        <Center style={{ flex: 1, position: "relative" }} p="md">
          <Box pos="absolute" top={16} right={16}>
            <ColorSchemeToggle />
          </Box>
          <Paper w="100%" maw={400} p={{ base: "lg", sm: "xl" }} radius="lg" withBorder shadow="sm">
            <Stack gap="lg">
              <Stack gap={4}>
                <Title order={2}>Welcome back</Title>
                <Text c="dimmed" size="sm">
                  Enter your email and password to continue.
                </Text>
              </Stack>
              <LoginForm />
            </Stack>
          </Paper>
        </Center>
      </Group>
    </Box>
  );
}
