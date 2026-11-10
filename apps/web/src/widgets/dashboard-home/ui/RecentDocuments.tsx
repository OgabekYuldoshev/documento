import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconDownload, IconFileText } from "@tabler/icons-react";
import { Link } from "react-router";
import {
  GENERATION_STATUS_META,
  getGenerationError,
  type RecentGeneration,
} from "@/entities/generation";
import { projectSectionPath } from "@/entities/project";
import { GenerateDocumentButton } from "@/features/generations/generate-document";
import { ROUTES } from "@/shared/config";
import { formatRelative } from "@/shared/lib";
import classes from "./home.module.scss";

const canDownload = (g: RecentGeneration) =>
  g.status === "ok" && (!g.pdfExpiresAt || g.pdfExpiresAt > new Date());

/** Latest documents across the user's projects: status at a glance, one click to the project log. */
export function RecentDocuments({ items }: { items: RecentGeneration[] }) {
  return (
    <Paper withBorder p={0} radius="md">
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <Text fw={600}>So'nggi hujjatlar</Text>
        <GenerateDocumentButton variant="default" />
      </Group>

      {items.length === 0 ? (
        <Stack align="center" gap={4} py="xl">
          <IconFileText size={28} stroke={1.4} color="var(--mantine-color-dimmed)" />
          <Text size="sm" fw={500}>
            Hozircha hujjat yo'q
          </Text>
          <Text size="xs" c="dimmed">
            API orqali yoki "Hujjat yaratish" bilan yaratilganlar shu yerda ko'rinadi.
          </Text>
        </Stack>
      ) : (
        <Stack gap={0}>
          {items.map((g) => {
            const meta = GENERATION_STATUS_META[g.status];
            const reason = getGenerationError(g);
            const badge = (
              <Badge variant="dot" color={meta.color}>
                {meta.label}
              </Badge>
            );
            return (
              <Group key={g.id} wrap="nowrap" gap="sm" className={classes.row} px="md" py={10}>
                <UnstyledButton
                  component={Link}
                  to={projectSectionPath(ROUTES.project(g.projectId), "documents")}
                  className={classes.rowLink}
                >
                  <Text size="sm" fw={500} lineClamp={1}>
                    {g.templateName}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {g.projectName} · {g.source === "api" ? "API" : "UI"} ·{" "}
                    {formatRelative(g.queuedAt)}
                  </Text>
                </UnstyledButton>
                {reason ? (
                  <Tooltip label={reason} multiline maw={360}>
                    {badge}
                  </Tooltip>
                ) : (
                  badge
                )}
                {canDownload(g) ? (
                  <Tooltip label="PDF yuklab olish">
                    <ActionIcon
                      component="a"
                      href={`/api/generations/${g.id}/file`}
                      download
                      variant="subtle"
                      color="gray"
                      aria-label="PDF yuklab olish"
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <span style={{ width: 28, flexShrink: 0 }} />
                )}
              </Group>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
