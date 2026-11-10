import { Center, Loader, Text } from "@mantine/core";
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
  /** Rendered at the far right of the top bar. */
  endSlot?: ReactNode;
  startSlot?: ReactNode;
};

export function TemplateEditor({
  projectId,
  templateId,
  projectName,
  templateName,
  description,
  endSlot,
  startSlot,
}: Props) {
  const ids = { projectId, templateId };
  const { data: draft, isPending } = useQuery(trpc.templates.draft.queryOptions(ids));
  const { data: current, isPending: currentPending } = useQuery(
    trpc.templates.current.queryOptions(ids),
  );
  // Bumped after a restore so the form remounts with the restored content.
  const [epoch, setEpoch] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);

  const start = useMutation({
    ...trpc.templates.getDraft.mutationOptions(),
    onSuccess: () => invalidateTemplateQueries(),
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  if (isPending || currentPending) {
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
        startSlot={startSlot}
      />
    );
  }

  if (current) {
    return (
      <DraftForm
        key={`${current.id}:${epoch}`}
        {...ids}
        draft={current}
        readOnly
        onStartEditing={() => start.mutate(ids)}
        startingEdit={start.isPending}
        title={templateName}
        description={description}
        breadcrumbs={breadcrumbs}
        apiPanel={apiPanel}
        versionsPanel={versionsPanel}
        endSlot={endSlot}
        startSlot={startSlot}
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
        startSlot={startSlot}
        actions={<PanelButtons onOpen={setPanel} showLimits={false} />}
      >
        <Center h="100%">
          <Text c="dimmed" size="sm">
            Shablonda hali versiya yo'q.
          </Text>
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
