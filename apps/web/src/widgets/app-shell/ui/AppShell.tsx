import { AppShell as MantineAppShell } from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";
import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar, HEADER_HEIGHT } from "./AppSidebar";

export function AppShell() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopCollapsed, setDesktopCollapsed] = useLocalStorage({
    key: "documento-sidebar-collapsed",
    defaultValue: false,
  });

  return (
    // "alt" layout: the sidebar spans the full height, the header sits over the content only.
    <MantineAppShell
      layout="alt"
      header={{ height: HEADER_HEIGHT }}
      navbar={{
        width: 272,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: desktopCollapsed },
      }}
      padding="lg"
    >
      <MantineAppShell.Header>
        <AppHeader
          mobileOpened={mobileOpened}
          onToggleMobile={toggleMobile}
          onToggleDesktop={() => setDesktopCollapsed((collapsed) => !collapsed)}
        />
      </MantineAppShell.Header>

      <MantineAppShell.Navbar>
        <AppSidebar onNavigate={closeMobile} />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
