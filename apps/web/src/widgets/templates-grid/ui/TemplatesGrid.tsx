import {
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconFilePlus, IconInbox, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CreateTemplateButton } from "@/features/templates/create-template";
import { trpc } from "@/shared/api";
import { TemplateCard } from "./template-card";
import classes from "./templates-grid.module.scss";

const GRID_COLS = { base: 1, xs: 2, md: 3, lg: 4, xl: 5 };

/** Google Docs-style gallery: "new" tile first, then templates (newest update first). */
export function TemplatesGrid({ projectId }: { projectId: string }) {
  const { data, isPending, error } = useQuery(trpc.templates.list.queryOptions({ projectId }));
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(data ?? [])]
      .filter((t) => !q || `${t.name} ${t.slug} ${t.description ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [data, search]);

  if (isPending) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center mih={240}>
        <Text c="red" size="sm">
          {error.message}
        </Text>
      </Center>
    );
  }

  const hasAny = (data?.length ?? 0) > 0;

  return (
    <Stack gap="lg">
      {hasAny && (
        <Group justify="space-between">
          <TextInput
            w={{ base: "100%", sm: 320 }}
            placeholder="Shablonlarni qidirish..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            aria-label="Shablonlarni qidirish"
          />
          <Text size="sm" c="dimmed">
            {data?.length} ta shablon
          </Text>
        </Group>
      )}

      {!hasAny ? (
        <Center mih={280}>
          <Stack align="center" gap={4}>
            <IconInbox size={36} stroke={1.4} color="var(--mantine-color-dimmed)" />
            <Text fw={600}>Hozircha shablon yo'q</Text>
            <Text c="dimmed" size="sm" mb="xs">
              Birinchi hujjat shablonini yarating
            </Text>
            <CreateTemplateButton projectId={projectId} />
          </Stack>
        </Center>
      ) : (
        <SimpleGrid cols={GRID_COLS} spacing="md">
          {!search && (
            <CreateTemplateButton
              projectId={projectId}
              renderTrigger={(open) => (
                <UnstyledButton onClick={open} className={classes.newTile}>
                  <IconFilePlus size={28} stroke={1.5} />
                  <Text fw={600} size="sm">
                    Yangi shablon
                  </Text>
                </UnstyledButton>
              )}
            />
          )}
          {items.map((template) => (
            <TemplateCard key={template.id} template={template} projectId={projectId} />
          ))}
        </SimpleGrid>
      )}

      {hasAny && items.length === 0 && (
        <Center mih={160}>
          <Text c="dimmed" size="sm">
            "{search}" bo'yicha shablon topilmadi
          </Text>
        </Center>
      )}
    </Stack>
  );
}
