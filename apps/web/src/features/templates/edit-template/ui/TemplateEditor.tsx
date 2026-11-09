import { Badge, Box, Button, Center, Loader, Stack, Tabs, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";
import { ApiSnippets } from "./ApiSnippets";
import { DraftForm } from "./DraftForm";
import { VersionHistory } from "./VersionHistory";
import { WorkspaceFrame, type WorkspaceTab } from "./WorkspaceFrame";

type Props = {
  projectId: string;
  templateId: string;
  projectName: string;
  templateName: string;
  description?: string;
  /** Number of the published version, when there is one. */
  currentNumber?: number | null;
};

const PANEL_WIDTH = 960;

export function TemplateEditor({
  projectId,
  templateId,
  projectName,
  templateName,
  description,
  currentNumber,
}: Props) {
  const ids = { projectId, templateId };
  const { data: draft, isPending } = useQuery(trpc.templates.draft.queryOptions(ids));
  // Bumped after a restore so the form remounts with the restored content.
  const [epoch, setEpoch] = useState(0);

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

  const extraTabs: WorkspaceTab[] = [
    {
      value: "api",
      label: "API",
      content: (
        <Box maw={PANEL_WIDTH}>
          <ApiSnippets {...ids} />
        </Box>
      ),
    },
    {
      value: "versions",
      label: "Versiyalar",
      content: (
        <Box maw={PANEL_WIDTH}>
          <VersionHistory {...ids} onRestored={() => setEpoch((n) => n + 1)} />
        </Box>
      ),
    },
  ];

  if (draft) {
    return (
      <DraftForm
        key={`${draft.id}:${epoch}`}
        {...ids}
        draft={draft}
        title={templateName}
        description={description}
        breadcrumbs={breadcrumbs}
        extraTabs={extraTabs}
      />
    );
  }

  return (
    <WorkspaceFrame
      breadcrumbs={breadcrumbs}
      title={templateName}
      description={description}
      badges={
        currentNumber ? (
          <Badge color="teal" variant="light">
            v{currentNumber} faol
          </Badge>
        ) : undefined
      }
      actions={
        <Button loading={start.isPending} onClick={() => start.mutate(ids)}>
          Tahrirlashni boshlash
        </Button>
      }
    >
      <Stack gap="md" h="100%">
        <Text c="dimmed" size="sm">
          Qoralama yo'q: joriy versiya o'zgarmas. Tahrirlash uchun undan yangi qoralama yarating.
        </Text>
        <Tabs defaultValue={extraTabs[0]?.value} h="100%">
          <Tabs.List mb="md">
            {extraTabs.map((t) => (
              <Tabs.Tab key={t.value} value={t.value}>
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {extraTabs.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              {t.content}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </WorkspaceFrame>
  );
}
