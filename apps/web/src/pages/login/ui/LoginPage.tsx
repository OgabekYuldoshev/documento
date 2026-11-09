import { Box, Center, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconFileText, IconShieldLock } from "@tabler/icons-react";
import { LoginForm } from "@/features/auth/login";
import { ColorSchemeToggle } from "@/features/theme/toggle-color-scheme";
import { DocumentPreview } from "./document-preview";

export function LoginPage() {
  return (
    <Group wrap="nowrap" gap={0} align="stretch" mih="100dvh" bg="var(--app-canvas)">
      <Box
        visibleFrom="md"
        p={56}
        style={{
          flex: 1.1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 40,
          color: "white",
          background:
            "radial-gradient(120% 90% at 0% 0%, var(--mantine-color-brand-6) 0%, var(--mantine-color-brand-9) 55%, #11173f 100%)",
        }}
      >
        <Group gap="sm">
          <ThemeIcon size={40} radius="md" variant="white" color="brand">
            <IconFileText size={22} />
          </ThemeIcon>
          <Text fw={700} fz={22} style={{ letterSpacing: "-0.02em" }}>
            Documento
          </Text>
        </Group>

        <Stack gap="xl" align="flex-start">
          <Stack gap="sm" maw={480}>
            <Title order={1} fz={40} lh={1.15} style={{ letterSpacing: "-0.03em" }}>
              Generate professional documents in seconds.
            </Title>
            <Text opacity={0.8} fz="md">
              Sign in with the account your administrator created for you.
            </Text>
          </Stack>
          <DocumentPreview />
        </Stack>

        <Group gap="xs" opacity={0.75}>
          <IconShieldLock size={18} />
          <Text size="sm">Access is invitation-only</Text>
        </Group>
      </Box>

      <Center style={{ flex: 1 }} p="md" pos="relative">
        <Box pos="absolute" top={16} right={16}>
          <ColorSchemeToggle />
        </Box>
        <Paper w="100%" maw={420} p={{ base: "lg", sm: 36 }} withBorder shadow="md">
          <Stack gap="xl">
            <Stack gap={6}>
              <Group gap="sm" hiddenFrom="md">
                <ThemeIcon size={36} radius="md">
                  <IconFileText size={20} />
                </ThemeIcon>
                <Text fw={700} fz="lg">
                  Documento
                </Text>
              </Group>
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
  );
}
