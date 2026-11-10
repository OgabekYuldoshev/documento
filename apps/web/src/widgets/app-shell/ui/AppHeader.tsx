import { Box, Burger, Group } from "@mantine/core";
import { ColorSchemeToggle } from "@/features/theme/toggle-color-scheme";
import { SearchTrigger } from "./SearchSpotlight";
import { SidebarToggleButton } from "./SidebarToggleButton";

type AppHeaderProps = {
  mobileOpened: boolean;
  onToggleMobile: () => void;
};

export function AppHeader({ mobileOpened, onToggleMobile }: AppHeaderProps) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm">
        <Burger opened={mobileOpened} onClick={onToggleMobile} hiddenFrom="sm" size="sm" />
        <Box visibleFrom="sm">
          <SidebarToggleButton />
        </Box>
      </Group>

      <Group gap="sm" wrap="nowrap">
        <Box w={{ base: 160, sm: 240 }}>
          <SearchTrigger />
        </Box>
        <ColorSchemeToggle />
      </Group>
    </Group>
  );
}
