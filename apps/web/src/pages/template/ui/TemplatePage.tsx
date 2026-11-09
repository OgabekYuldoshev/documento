import { Center, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { TemplateEditor } from "@/features/templates/edit-template";
import { trpc } from "@/shared/api";

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
    <TemplateEditor
      projectId={projectId}
      templateId={templateId}
      projectName={project.data.name}
      templateName={info.data.template.name}
      description={info.data.template.description ?? undefined}
      currentNumber={info.data.current?.number}
    />
  );
}
