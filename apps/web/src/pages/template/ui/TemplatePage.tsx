import { Anchor, Breadcrumbs, Center, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { TemplateEditor } from "@/features/templates/edit-template";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { PageHeader } from "@/shared/ui";

export function TemplatePage() {
  const { projectId = "", templateId = "" } = useParams();
  const project = useQuery(trpc.projects.get.queryOptions({ projectId }));
  const info = useQuery(trpc.templates.get.queryOptions({ projectId, templateId }));

  if (project.isPending || info.isPending) {
    return (
      <Center mih="40dvh">
        <Loader />
      </Center>
    );
  }
  if (!project.data || !info.data) {
    return (
      <Center mih="40dvh">
        <Text>Shablon topilmadi</Text>
      </Center>
    );
  }

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor component={Link} to={ROUTES.projects} size="sm">
          Project'lar
        </Anchor>
        <Anchor component={Link} to={ROUTES.project(projectId)} size="sm">
          {project.data.name}
        </Anchor>
      </Breadcrumbs>
      <PageHeader
        title={info.data.template.name}
        description={info.data.template.description ?? undefined}
      />
      <TemplateEditor projectId={projectId} templateId={templateId} />
    </>
  );
}
