import { Badge, Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";
import { ApiSnippets } from "./ApiSnippets";
import { DraftForm } from "./DraftForm";
import { type Panel, PanelButtons, ReferenceDrawers } from "./ReferencePanels";
import { VersionHistory } from "./VersionHistory";
import { WorkspaceFrame } from "./WorkspaceFrame";

type Props = {
  projectId: string;
  templateId: string;
  projectName: string;
  templateName: string;
  description?: string;
  /** Number of the published version, when there is one. */
  currentNumber?: number | null;
  /** Rendered at the far right of the top bar. */
  endSlot?: ReactNode;
};

export function TemplateEditor({
  projectId,
  templateId,
  projectName,
  templateName,
  description,
  currentNumber,
  endSlot,
}: Props) {
  const ids = { projectId, templateId };
  const { data: draft, isPending } = useQuery(trpc.templates.draft.queryOptions(ids));
  // Bumped after a restore so the form remounts with the restored content.
  const [epoch, setEpoch] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);

  const start = useMutation({
    ...trpc.templates.getDraft.mutationOptions(),
    onSuccess: () => invalidateTemplateQueries(),
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  if (isPending) {
    return (
      <Center mih="30dvh">
        <Loader />
      </Center>
    );
  }

  const breadcrumbs = [
    { label: "Project'lar", to: ROUTES.projects },
    { label: projectName, to: ROUTES.project(projectId) },
  ];
  const apiPanel = <ApiSnippets {...ids} />;
  const versionsPanel = (
    <VersionHistory
      {...ids}
      onRestored={() => {
        setEpoch((n) => n + 1);
        setPanel(null);
      }}
    />
  );

  if (draft) {
    return (
      <DraftForm
        key={`${draft.id}:${epoch}`}
        {...ids}
        draft={draft}
        title={templateName}
        description={description}
        breadcrumbs={breadcrumbs}
        apiPanel={apiPanel}
        versionsPanel={versionsPanel}
        endSlot={endSlot}
      />
    );
  }

  return (
    <>
      <WorkspaceFrame
        breadcrumbs={breadcrumbs}
        title={templateName}
        description={description}
        endSlot={endSlot}
        badges={
          currentNumber ? (
            <Badge color="teal" variant="light">
              v{currentNumber} faol
            </Badge>
          ) : undefined
        }
        actions={
          <Group gap="xs" wrap="nowrap">
            <PanelButtons onOpen={setPanel} showLimits={false} />
            <Button loading={start.isPending} onClick={() => start.mutate(ids)}>
              Tahrirlashni boshlash
            </Button>
          </Group>
        }
      >
        <Center h="100%">
          <Stack align="center" gap="xs" maw={420} ta="center">
            <Text fw={600}>Qoralama yo'q</Text>
            <Text c="dimmed" size="sm">
              Joriy versiya o'zgarmas. Tahrirlash uchun undan yangi qoralama yarating.
            </Text>
          </Stack>
        </Center>
      </WorkspaceFrame>
      <ReferenceDrawers
        open={panel}
        onClose={() => setPanel(null)}
        apiPanel={apiPanel}
        versionsPanel={versionsPanel}
      />
    </>
  );
}
