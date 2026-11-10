import {
  ActionIcon,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconFolder, IconPlus, IconTemplate } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router";
import type { Project } from "@/entities/project";
import { CreateProjectButton } from "@/features/projects/create-project";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import classes from "./home.module.scss";

const PROJECT_LIMIT = 5;

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder p={0} radius="md">
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <Text fw={600}>{title}</Text>
        {action}
      </Group>
      <Stack gap={0}>{children}</Stack>
    </Paper>
  );
}

function Row({
  to,
  icon,
  title,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <UnstyledButton component={Link} to={to} className={classes.row}>
      <Group wrap="nowrap" gap="sm" px="md" py={10}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} lineClamp={1}>
            {title}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {hint}
            </Text>
          )}
        </div>
      </Group>
    </UnstyledButton>
  );
}

/** Shortcuts: the newest projects and the templates edited last. */
export function QuickAccess({ projects }: { projects: Project[] }) {
  const { data: templates, isPending } = useQuery(trpc.templates.recent.queryOptions());

  const latest = useMemo(
    () =>
      [...projects]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, PROJECT_LIMIT),
    [projects],
  );

  return (
    <Stack gap="md">
      <Card
        title="Project'lar"
        action={
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" component={Link} to={ROUTES.projects}>
              Hammasi ({projects.length})
            </Text>
            <CreateProjectButton
              renderTrigger={(open) => (
                <Tooltip label="Yangi project">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Yangi project"
                    onClick={open}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            />
          </Group>
        }
      >
        {latest.map((p) => (
          <Row
            key={p.id}
            to={ROUTES.project(p.id)}
            icon={<IconFolder size={18} stroke={1.6} color="var(--mantine-color-dimmed)" />}
            title={p.name}
            hint={p.description ?? undefined}
          />
        ))}
      </Card>

      <Card title="So'nggi shablonlar">
        {isPending && <Skeleton h={40} m="sm" />}
        {templates?.length === 0 && (
          <Text size="xs" c="dimmed" px="md" py="md">
            Shablon yaratilgach, shu yerda tezkor havola chiqadi.
          </Text>
        )}
        {templates?.map((t) => (
          <Row
            key={t.id}
            to={ROUTES.template(t.projectId, t.id)}
            icon={<IconTemplate size={18} stroke={1.6} color="var(--mantine-color-dimmed)" />}
            title={t.name}
            hint={t.projectName}
          />
        ))}
      </Card>
    </Stack>
  );
}
