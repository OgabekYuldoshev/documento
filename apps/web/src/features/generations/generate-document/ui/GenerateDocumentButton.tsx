import { Alert, Button, Drawer, Group, Loader, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useProjects } from "@/entities/project";
import { getErrorMessage, queryClient, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { pruneEmpty, type SchemaNode } from "../model/schema-form";
import { GenerationResult } from "./GenerationResult";
import { SchemaField } from "./SchemaField";

type Props = {
  /** Omit on pages that are not inside a project (the dashboard): a project is picked first. */
  projectId?: string;
  /** Skips the template choice (e.g. when started from a template card). */
  templateId?: string;
  variant?: "filled" | "default";
};

/**
 * "Hujjat yaratish": pick a published template, fill a form generated from its JSON Schema, run
 * it through the real pipeline (queue, validation, Typst) and see the PDF, without the API.
 */
export function GenerateDocumentButton({ projectId, templateId, variant = "filled" }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button variant={variant} leftSection={<IconPlus size={16} />} onClick={open}>
        Hujjat yaratish
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="min(760px, 100vw)"
        title="Hujjat yaratish"
        styles={{
          header: { borderBottom: "1px solid var(--app-border)" },
          body: { paddingTop: "var(--mantine-spacing-md)", height: "calc(100% - 60px)" },
        }}
      >
        {/* Mounted only while open: every opening starts from a fresh form. */}
        {opened && <ProjectStep fixedProjectId={projectId} fixedTemplateId={templateId} />}
      </Drawer>
    </>
  );
}

/** Picks the project when the button lives outside one; then hands over to the template step. */
function ProjectStep({
  fixedProjectId,
  fixedTemplateId,
}: {
  fixedProjectId?: string;
  fixedTemplateId?: string;
}) {
  const { data: projects, isPending } = useProjects();
  const [picked, setPicked] = useState<string | null>(null);

  if (fixedProjectId) {
    return <GenerateFlow projectId={fixedProjectId} fixedTemplateId={fixedTemplateId} />;
  }
  if (isPending) return <Loader size="sm" mx="auto" my="xl" />;
  if (!projects?.length) {
    return (
      <Alert color="yellow" variant="light" title="Project yo'q">
        Hujjat yaratish uchun avval project va shablon yarating.
      </Alert>
    );
  }

  // One project needs no question.
  const projectId = picked ?? (projects.length === 1 ? projects[0]?.id : null);

  return (
    <Stack gap="md" h="100%">
      {projects.length > 1 && (
        <Select
          label="Project"
          placeholder="Projectni tanlang"
          data={projects.map((p) => ({ value: p.id, label: p.name }))}
          value={picked}
          onChange={setPicked}
        />
      )}
      {projectId && <GenerateFlow key={projectId} projectId={projectId} />}
    </Stack>
  );
}

function GenerateFlow({
  projectId,
  fixedTemplateId,
}: {
  projectId: string;
  fixedTemplateId?: string;
}) {
  const { data: templates, isPending } = useQuery(trpc.templates.list.queryOptions({ projectId }));
  const [picked, setPicked] = useState<string | null>(null);

  if (isPending) return <Loader size="sm" mx="auto" my="xl" />;

  const published = (templates ?? []).filter((t) => t.currentNumber !== null);
  if (published.length === 0) {
    return (
      <Alert color="yellow" variant="light" title="Publish qilingan shablon yo'q">
        Hujjat yaratish uchun avval shablonni publish qiling.
      </Alert>
    );
  }

  // One published template needs no question.
  const templateId =
    fixedTemplateId ?? picked ?? (published.length === 1 ? published[0]?.id : null);

  return (
    <Stack gap="md" h="100%">
      {!fixedTemplateId && published.length > 1 && (
        <Select
          label="Shablon"
          placeholder="Shablonni tanlang"
          data={published.map((t) => ({ value: t.id, label: `${t.name} (v${t.currentNumber})` }))}
          value={picked}
          onChange={setPicked}
        />
      )}
      {templateId && (
        <GenerateForm key={templateId} projectId={projectId} templateId={templateId} />
      )}
    </Stack>
  );
}

function GenerateForm({ projectId, templateId }: { projectId: string; templateId: string }) {
  const ids = { projectId, templateId };
  const { data: version } = useQuery(trpc.templates.current.queryOptions(ids));
  const [data, setData] = useState<unknown>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  const create = useMutation({
    ...trpc.generations.create.mutationOptions(),
    onSuccess: (generation) => {
      setGenerationId(generation.id);
      // The "Hujjatlar" table picks the new row up.
      queryClient.invalidateQueries(trpc.generations.pathFilter());
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  if (!version) return <Loader size="sm" mx="auto" my="xl" />;

  const schema = version.schema as SchemaNode;
  // Starts from the published sample so the form is never an empty wall of inputs.
  const values = (data ?? version.sampleData) as Record<string, unknown>;

  function submit() {
    create.mutate({
      ...ids,
      data: (pruneEmpty(schema, values) ?? {}) as Record<string, unknown>,
      waitMs: 0,
    });
  }

  if (generationId) {
    return (
      <GenerationResult
        projectId={projectId}
        generationId={generationId}
        onEdit={() => setGenerationId(null)}
        onRestart={() => {
          setGenerationId(null);
          submit();
        }}
      />
    );
  }

  return (
    <Stack gap="md" pb="xl">
      <Text size="sm" c="dimmed">
        Publish qilingan v{version.number} bilan hujjat yaratiladi. Forma shablonning JSON
        Schema'sidan qurilgan.
      </Text>
      {schema.properties ? (
        <Stack gap="sm">
          {Object.entries(schema.properties).map(([key, child]) => (
            <SchemaField
              key={key}
              projectId={projectId}
              node={child}
              label={child.title ?? key}
              required={schema.required?.includes(key) ?? false}
              value={values[key]}
              onChange={(v) => setData({ ...values, [key]: v })}
            />
          ))}
        </Stack>
      ) : (
        <Alert color="yellow" variant="light">
          Schemada maydonlar yo'q.
        </Alert>
      )}
      <Group justify="flex-end">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={create.isPending}
          onClick={submit}
        >
          Yaratish
        </Button>
      </Group>
    </Stack>
  );
}
