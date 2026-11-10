import { Group, Kbd, Text, UnstyledButton } from "@mantine/core";
import {
  Spotlight,
  type SpotlightActionData,
  type SpotlightActionGroupData,
  spotlight,
} from "@mantine/spotlight";
import { IconFolder, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useMatch, useNavigate } from "react-router";
import {
  canManageProject,
  projectSectionPath,
  useProjects,
  visibleSections,
} from "@/entities/project";
import { useSession } from "@/entities/session";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { getVisibleNavigation } from "../model/navigation";
import classes from "./search-trigger.module.scss";

/** Sidebar search field; opens the ⌘K command palette (also bound to Ctrl/⌘ + K). */
export function SearchTrigger() {
  return (
    <UnstyledButton className={classes.trigger} onClick={() => spotlight.open()}>
      <IconSearch size={15} stroke={1.8} />
      <Text size="sm" c="dimmed" ta="center" style={{ flex: 1 }}>
        Qidirish
      </Text>
      <Group gap={4} wrap="nowrap">
        <Kbd size="xs">⌘</Kbd>
        <Kbd size="xs">K</Kbd>
      </Group>
    </UnstyledButton>
  );
}

/** Command palette: pages, projects, and the open project's sections and templates. */
export function SearchSpotlight() {
  const navigate = useNavigate();
  const { isAdmin, user } = useSession();
  const { data: projects } = useProjects();
  const activeId = useMatch(`${ROUTES.projects}/:projectId`)?.params.projectId;
  const { data: templates } = useQuery({
    ...trpc.templates.list.queryOptions({ projectId: activeId ?? "" }),
    enabled: Boolean(activeId),
  });

  const actions = useMemo(() => {
    const go = (to: string) => () => navigate(to);
    const groups: SpotlightActionGroupData[] = [];

    const pages: SpotlightActionData[] = getVisibleNavigation(isAdmin).flatMap((g) =>
      g.items.map((item) => ({
        id: item.to,
        label: item.label,
        leftSection: <item.icon size={18} stroke={1.6} />,
        onClick: go(item.to),
      })),
    );
    groups.push({ group: "Sahifalar", actions: pages });

    const active = projects?.find((p) => p.id === activeId);
    if (active) {
      const base = ROUTES.project(active.id);
      groups.push({
        group: active.name,
        actions: [
          ...visibleSections(canManageProject(active, user)).map((s) => ({
            id: `section-${s.value}`,
            label: s.label,
            description: "Project bo'limi",
            leftSection: <s.icon size={18} stroke={1.6} />,
            onClick: go(projectSectionPath(base, s.value)),
          })),
          ...(templates ?? []).map((t) => ({
            id: `template-${t.id}`,
            label: t.name,
            description: `Shablon · ${active.name}`,
            leftSection: <IconFolder size={18} stroke={1.6} />,
            onClick: go(ROUTES.template(active.id, t.id)),
          })),
        ],
      });
    }

    groups.push({
      group: "Project'lar",
      actions: (projects ?? []).map((p) => ({
        id: `project-${p.id}`,
        label: p.name,
        description: p.description ?? undefined,
        leftSection: <IconFolder size={18} stroke={1.6} />,
        onClick: go(ROUTES.project(p.id)),
      })),
    });
    return groups;
  }, [projects, templates, activeId, isAdmin, navigate, user]);

  return (
    <Spotlight
      actions={actions}
      shortcut={["mod + K", "/"]}
      highlightQuery
      limit={12}
      scrollable
      maxHeight={420}
      nothingFound="Hech narsa topilmadi"
      searchProps={{
        leftSection: <IconSearch size={18} stroke={1.6} />,
        placeholder: "Project, shablon yoki sahifa qidiring…",
      }}
    />
  );
}
