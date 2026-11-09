import { Button, Center, Group, Loader, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { CreateApiKeyButton } from "@/features/api-keys/create-api-key";
import { ProjectSettingsForm } from "@/features/projects/update-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { formatDate } from "@/shared/lib";
import { PageHeader } from "@/shared/ui";
import { ApiKeysTable } from "@/widgets/api-keys-table";
import { GenerationsTable } from "@/widgets/generations-table";
import { TemplatesGrid } from "@/widgets/templates-grid";

const DEFAULT_RETENTION_DAYS_LABEL = "Standart";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </div>
  );
}

export function ProjectPage() {
  const { projectId = "" } = useParams();
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
          <Tabs.Tab value="overview">Umumiy ma'lumot</Tabs.Tab>
          <Tabs.Tab value="settings">Sozlamalar</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates">
          <TemplatesGrid projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="documents">
          <GenerationsTable projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="keys">
          <Group justify="flex-end" mb="md">
            <CreateApiKeyButton projectId={project.id} />
          </Group>
          <ApiKeysTable projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="overview">
          <Paper withBorder p="lg" maw={520}>
            <Group gap="xl" align="flex-start">
              <Field label="Slug" value={project.slug} />
              <Field label="Yaratilgan" value={formatDate(project.createdAt)} />
              <Field
                label="PDF saqlash muddati"
                value={
                  project.retentionDays === null
                    ? DEFAULT_RETENTION_DAYS_LABEL
                    : `${project.retentionDays} kun`
                }
              />
            </Group>
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="settings">
          <ProjectSettingsForm key={project.updatedAt.getTime()} project={project} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
