import { NavLink, Skeleton, Stack } from "@mantine/core";
import { IconFolder, IconFolderOpen } from "@tabler/icons-react";
import { useMemo } from "react";
import { NavLink as RouterLink, useMatch, useSearchParams } from "react-router";
import {
  PROJECT_SECTIONS,
  parseSection,
  projectSectionPath,
  useProjects,
} from "@/entities/project";
import { ROUTES } from "@/shared/config";
import classes from "./sidebar-projects.module.scss";

const VISIBLE_COUNT = 4;

/** Newest projects nested under "Project'lar"; the open project expands into its sections. */
export function SidebarProjects({ onNavigate }: { onNavigate: () => void }) {
  const { data, isPending } = useProjects();
  const activeId = useMatch(`${ROUTES.projects}/:projectId`)?.params.projectId;
  const [params] = useSearchParams();
  const section = parseSection(params.get("tab"));

  const visible = useMemo(() => {
    const sorted = [...(data ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = sorted.slice(0, VISIBLE_COUNT);
    // An older project that is open right now must not vanish from the list.
    const open = sorted.find((p) => p.id === activeId);
    return open && !latest.includes(open) ? [...latest, open] : latest;
  }, [data, activeId]);

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
    <Stack gap={1} pl="md">
      {visible.map((project) => {
        const open = project.id === activeId;
        const base = ROUTES.project(project.id);
        return (
          <div key={project.id}>
            <NavLink
              component={RouterLink}
              to={base}
              end
              // The open project's active section carries the highlight, not the folder row.
              fw={open ? 650 : undefined}
              label={project.name}
              leftSection={
                open ? (
                  <IconFolderOpen size={16} stroke={1.6} />
                ) : (
                  <IconFolder size={16} stroke={1.6} />
                )
              }
              onClick={onNavigate}
              classNames={{ label: classes.label }}
              styles={{ root: { padding: "7px 12px" } }}
            />
            {open && (
              <Stack gap={1} className={classes.sections}>
                {PROJECT_SECTIONS.map((item) => (
                  <NavLink
                    key={item.value}
                    component={RouterLink}
                    to={projectSectionPath(base, item.value)}
                    // The query string is not part of route matching: decide "active" by hand.
                    active={section === item.value}
                    label={item.label}
                    leftSection={<item.icon size={15} stroke={1.6} />}
                    onClick={onNavigate}
                    styles={{
                      root: {
                        padding: "5px 10px",
                        fontSize: "var(--mantine-font-size-sm)",
                        fontWeight: 450,
                      },
                    }}
                  />
                ))}
              </Stack>
            )}
          </div>
        );
      })}
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
    </Stack>
  );
}
