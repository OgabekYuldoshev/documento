import { Button, Center, Group, Loader, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  canManageProject,
  DEFAULT_SECTION,
  parseSection,
  visibleSections,
} from "@/entities/project";
import { useSession } from "@/entities/session";
import { ArchiveProjectButton } from "@/features/projects/archive-project";
import { DeleteProjectButton } from "@/features/projects/delete-project";
import { TransferOwnerButton } from "@/features/projects/members";
import { ProjectSettingsForm } from "@/features/projects/update-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { PageHeader, SettingsSection } from "@/shared/ui";
import { ApiKeysTable } from "@/widgets/api-keys-table";
import { GenerationsTable } from "@/widgets/generations-table";
import { ProjectMembersTable } from "@/widgets/project-members-table";
import { TemplatesGrid } from "@/widgets/templates-grid";
import { WebhookPanel } from "@/widgets/webhook-panel";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = parseSection(params.get("tab"));
  const { user } = useSession();
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
      <Tabs
        value={section}
        keepMounted={false}
        onChange={(value) =>
          setParams(value && value !== DEFAULT_SECTION ? { tab: value } : {}, { replace: true })
        }
      >
        <Tabs.List mb="lg">
          {visibleSections(canManageProject(project, user)).map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
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
        {canManageProject(project, user) && (
          <Tabs.Panel value="webhooks">
            <WebhookPanel projectId={project.id} />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="members">
          <ProjectMembersTable projectId={project.id} ownerId={project.ownerId} />
        </Tabs.Panel>
        <Tabs.Panel value="settings">
          <Stack gap="md">
            <ProjectSettingsForm key={project.updatedAt.getTime()} project={project} />
            {canManageProject(project, user) && (
              <SettingsSection
                danger
                title="Xavfli hudud"
                description="Qaytarib bo'lmaydigan yoki ehtiyotkorlik talab qiladigan amallar."
              >
                <Stack gap="lg">
                  <Group justify="space-between" wrap="wrap" align="center" gap="md">
                    <div>
                      <Text fw={500}>Egasini almashtirish</Text>
                      <Text size="sm" c="dimmed">
                        Project boshqa a'zoga o'tadi, siz a'zo bo'lib qolasiz.
                      </Text>
                    </div>
                    <TransferOwnerButton projectId={project.id} projectName={project.name} />
                  </Group>
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
                  <Group justify="space-between" wrap="wrap" align="center" gap="md">
                    <div>
                      <Text fw={500}>Projectni butunlay o'chirish</Text>
                      <Text size="sm" c="dimmed">
                        Shablonlar, API keylar, hujjatlar va fayllar bilan birga qaytarib
                        bo'lmaydigan qilib o'chadi.
                      </Text>
                    </div>
                    <DeleteProjectButton
                      id={project.id}
                      name={project.name}
                      onDeleted={() => navigate(ROUTES.projects)}
                    />
                  </Group>
                </Stack>
              </SettingsSection>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
