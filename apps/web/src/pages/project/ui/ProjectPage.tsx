import { Button, Center, Group, Loader, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { ArchiveProjectButton } from "@/features/projects/archive-project";
import { ProjectSettingsForm } from "@/features/projects/update-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { PageHeader, SettingsSection } from "@/shared/ui";
import { ApiKeysTable } from "@/widgets/api-keys-table";
import { GenerationsTable } from "@/widgets/generations-table";
import { TemplatesGrid } from "@/widgets/templates-grid";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const {
    data: project,
    isPending,
    error,
  } = useQuery(trpc.projects.get.queryOptions({ projectId }));

  if (isPending) {
    return (
      <Center mih="40dvh">
        <Loader />
      </Center>
    );
  }

  if (error || !project) {
    return (
      <Center mih="50dvh">
        <Stack align="center" gap="xs">
          <Title order={3}>Project topilmadi</Title>
          <Button component={Link} to={ROUTES.projects} variant="light">
            Project'larga qaytish
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <PageHeader title={project.name} description={project.description ?? undefined} />
      <Tabs defaultValue="templates" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="templates">Shablonlar</Tabs.Tab>
          <Tabs.Tab value="documents">Hujjatlar</Tabs.Tab>
          <Tabs.Tab value="keys">API keylar</Tabs.Tab>
          <Tabs.Tab value="settings">Sozlamalar</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates">
          <TemplatesGrid projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="documents">
          <GenerationsTable projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="keys">
          <ApiKeysTable projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="settings">
          <Stack gap="md">
            <ProjectSettingsForm key={project.updatedAt.getTime()} project={project} />
            <SettingsSection
              danger
              title="Xavfli hudud"
              description="Qaytarib bo'lmaydigan yoki ehtiyotkorlik talab qiladigan amallar."
            >
              <Group justify="space-between" wrap="wrap" align="center" gap="md">
                <div>
                  <Text fw={500}>Projectni arxivlash</Text>
                  <Text size="sm" c="dimmed">
                    Project ro'yxatdan yo'qoladi, shablonlari va API keylari ishlamay qoladi.
                  </Text>
                </div>
                <ArchiveProjectButton
                  id={project.id}
                  name={project.name}
                  onArchived={() => navigate(ROUTES.projects)}
                  renderTrigger={(open) => (
                    <Button
                      color="red"
                      variant="light"
                      leftSection={<IconArchive size={16} />}
                      onClick={open}
                    >
                      Arxivlash
                    </Button>
                  )}
                />
              </Group>
            </SettingsSection>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
