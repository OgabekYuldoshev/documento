import { ActionIcon, Burger, Group, Tooltip } from "@mantine/core";
import { IconLayoutSidebar } from "@tabler/icons-react";
import { ColorSchemeToggle } from "@/features/theme/toggle-color-scheme";

type AppHeaderProps = {
  mobileOpened: boolean;
  onToggleMobile: () => void;
  onToggleDesktop: () => void;
};

export function AppHeader({ mobileOpened, onToggleMobile, onToggleDesktop }: AppHeaderProps) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm">
        <Burger opened={mobileOpened} onClick={onToggleMobile} hiddenFrom="sm" size="sm" />
        <Tooltip label="Toggle sidebar">
          <ActionIcon
            variant="default"
            size="lg"
            visibleFrom="sm"
            aria-label="Toggle sidebar"
            onClick={onToggleDesktop}
          >
            <IconLayoutSidebar size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ColorSchemeToggle />
    </Group>
  );
}
