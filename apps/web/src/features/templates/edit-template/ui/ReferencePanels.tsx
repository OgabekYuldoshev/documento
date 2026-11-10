import { ActionIcon, Drawer, Group, Tooltip } from "@mantine/core";
import { IconAdjustments, IconCode, IconHistory } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type Panel = "limits" | "api" | "versions";

type ButtonsProps = {
  onOpen: (panel: Panel) => void;
  /** Hide the limits button when there is no draft to edit. */
  showLimits?: boolean;
};

/** Header icon buttons that open the reference panels instead of permanent tabs. */
export function PanelButtons({ onOpen, showLimits = true }: ButtonsProps) {
  const items: { panel: Panel; label: string; icon: ReactNode; hidden?: boolean }[] = [
    {
      panel: "limits",
      label: "Limitlar",
      icon: <IconAdjustments size={18} />,
      hidden: !showLimits,
    },
    { panel: "api", label: "API orqali ishlatish", icon: <IconCode size={18} /> },
    { panel: "versions", label: "Versiyalar", icon: <IconHistory size={18} /> },
  ];
  return (
    <Group gap={2} wrap="nowrap">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <Tooltip key={i.panel} label={i.label}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={i.label}
              onClick={() => onOpen(i.panel)}
            >
              {i.icon}
            </ActionIcon>
          </Tooltip>
        ))}
    </Group>
  );
}

type DrawersProps = {
  open: Panel | null;
  onClose: () => void;
  apiPanel: ReactNode;
  versionsPanel: ReactNode;
};

/** Right-side drawers for API snippets and version history. */
export function ReferenceDrawers({ open, onClose, apiPanel, versionsPanel }: DrawersProps) {
  return (
    <>
      <Drawer
        opened={open === "api"}
        onClose={onClose}
        position="right"
        size="min(620px, 100vw)"
        title="API orqali ishlatish"
      >
        {apiPanel}
      </Drawer>
      <Drawer
        opened={open === "versions"}
        onClose={onClose}
        position="right"
        size="min(460px, 100vw)"
        title="Versiyalar"
      >
        {versionsPanel}
      </Drawer>
    </>
  );
}
