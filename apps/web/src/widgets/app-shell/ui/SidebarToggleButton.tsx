import { ActionIcon, Tooltip } from "@mantine/core";
import { IconLayoutSidebar } from "@tabler/icons-react";
import { useSidebarControl } from "../model/sidebar-control";

/** Opens/closes the app sidebar; used by the app header and the template editor bar. */
export function SidebarToggleButton() {
  const { toggle } = useSidebarControl();
  return (
    <Tooltip label="Sidebar">
      <ActionIcon
        variant="light"
        color="gray"
        size="lg"
        aria-label="Sidebar'ni almashtirish"
        onClick={toggle}
      >
        <IconLayoutSidebar size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
