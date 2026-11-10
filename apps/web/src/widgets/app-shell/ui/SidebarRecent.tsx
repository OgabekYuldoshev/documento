import { IconTemplate } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarLink } from "./sidebar-link";

/** Last edited templates: one click back into the editor, whichever project they live in. */
export function SidebarRecent({ onNavigate }: { onNavigate: () => void }) {
  const { data } = useQuery(trpc.templates.recent.queryOptions());
  if (!data?.length) return null;

  return (
    <SidebarGroup title="So'nggi">
      {data.map((t) => (
        <SidebarLink
          key={t.id}
          size="sm"
          to={ROUTES.template(t.projectId, t.id)}
          label={t.name}
          hint={t.projectName}
          icon={<IconTemplate size={15} stroke={1.7} />}
          onNavigate={onNavigate}
        />
      ))}
    </SidebarGroup>
  );
}
