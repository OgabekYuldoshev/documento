import { Skeleton, Stack } from "@mantine/core";
import { IconDots, IconFolder, IconFolderOpen, IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import { useMatch, useSearchParams } from "react-router";
import {
  PROJECT_SECTIONS,
  parseSection,
  projectSectionPath,
  useProjects,
} from "@/entities/project";
import { CreateProjectButton } from "@/features/projects/create-project";
import { ROUTES } from "@/shared/config";
import { SidebarAction, SidebarLink } from "./sidebar-link";
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
      <Stack gap={6} pl={22} py={4}>
        <Skeleton h={22} />
        <Skeleton h={22} />
      </Stack>
    );
  }

  const total = data?.length ?? 0;

  return (
    <div className={classes.tree}>
      {visible.map((project) => {
        const open = project.id === activeId;
        const base = ROUTES.project(project.id);
        return (
          <div key={project.id}>
            <SidebarLink
              size="sm"
              to={base}
              end
              // The open project's active section carries the highlight, not the folder row.
              active={false}
              label={project.name}
              icon={
                open ? (
                  <IconFolderOpen size={15} stroke={1.7} />
                ) : (
                  <IconFolder size={15} stroke={1.7} />
                )
              }
              onNavigate={onNavigate}
            />
            {open && (
              <div className={classes.sections}>
                {PROJECT_SECTIONS.map((item) => (
                  <SidebarLink
                    key={item.value}
                    size="sm"
                    to={projectSectionPath(base, item.value)}
                    // The query string is not part of route matching: decide "active" by hand.
                    active={section === item.value}
                    label={item.label}
                    icon={<item.icon size={15} stroke={1.7} />}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {total > VISIBLE_COUNT && (
        <SidebarLink
          size="sm"
          to={ROUTES.projects}
          end
          active={false}
          label={`Hammasi (${total})`}
          icon={<IconDots size={15} stroke={1.7} />}
          onNavigate={onNavigate}
        />
      )}
      <CreateProjectButton
        renderTrigger={(open) => (
          <SidebarAction
            label="Yangi project"
            icon={<IconPlus size={15} stroke={1.7} />}
            onClick={() => {
              onNavigate();
              open();
            }}
          />
        )}
      />
    </div>
  );
}
