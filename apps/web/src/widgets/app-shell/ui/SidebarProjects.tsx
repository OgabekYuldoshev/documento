import { NavLink, Skeleton, Stack } from "@mantine/core";
import { IconFolder, IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import { NavLink as RouterLink } from "react-router";
import { useProjects } from "@/entities/project";
import { CreateProjectButton } from "@/features/projects/create-project";
import { ROUTES } from "@/shared/config";

const VISIBLE_COUNT = 4;

/** Newest projects nested under the "Project'lar" nav item for one-click access. */
export function SidebarProjects({ onNavigate }: { onNavigate: () => void }) {
  const { data, isPending } = useProjects();

  const latest = useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, VISIBLE_COUNT),
    [data],
  );

  if (isPending) {
    return (
      <Stack gap={6} pl="md" py={4}>
        <Skeleton h={22} />
        <Skeleton h={22} />
      </Stack>
    );
  }

  const total = data?.length ?? 0;

  return (
    <Stack gap={2} pl="md">
      {latest.map((project) => (
        <NavLink
          key={project.id}
          component={RouterLink}
          to={ROUTES.project(project.id)}
          label={project.name}
          leftSection={<IconFolder size={16} stroke={1.6} />}
          onClick={onNavigate}
          styles={{ label: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
        />
      ))}
      {total > VISIBLE_COUNT && (
        <NavLink
          component={RouterLink}
          to={ROUTES.projects}
          end
          label={`Hammasi (${total})`}
          c="dimmed"
          fz="xs"
          onClick={onNavigate}
        />
      )}
      <CreateProjectButton
        renderTrigger={(open) => (
          <NavLink
            label="Yangi project"
            leftSection={<IconPlus size={16} stroke={1.6} />}
            c="dimmed"
            onClick={() => {
              onNavigate();
              open();
            }}
          />
        )}
      />
    </Stack>
  );
}
