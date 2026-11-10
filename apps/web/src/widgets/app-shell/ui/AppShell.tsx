import { AppShell as MantineAppShell } from "@mantine/core";
import { useDisclosure, useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { Outlet, useMatch } from "react-router";
import { APP_HEADER_HEIGHT, ROUTES } from "@/shared/config";
import { SidebarControlContext } from "../model/sidebar-control";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { SearchSpotlight } from "./SearchSpotlight";

export function AppShell() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopCollapsed, setDesktopCollapsed] = useLocalStorage({
    key: "documento-sidebar-collapsed",
    defaultValue: false,
  });
  const desktop = useMediaQuery("(min-width: 48em)", true);

  // The template editor needs the whole width: the sidebar starts closed there (opening it is a
  // temporary choice that does not touch the saved preference) and the app header is dropped.
  const inEditor = Boolean(useMatch(ROUTES.template(":projectId", ":templateId")));
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);

  const control = useMemo(
    () => ({
      toggle: () => {
        if (!desktop) toggleMobile();
        else if (inEditor) setEditorSidebarOpen((open) => !open);
        else setDesktopCollapsed((collapsed) => !collapsed);
      },
    }),
    [desktop, inEditor, toggleMobile, setDesktopCollapsed],
  );

  return (
    <SidebarControlContext.Provider value={control}>
      {/* "alt" layout: the sidebar spans the full height, the header sits over the content only. */}
      <MantineAppShell
        layout="alt"
        header={{ height: inEditor ? 0 : APP_HEADER_HEIGHT }}
        navbar={{
          width: 272,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: inEditor ? !editorSidebarOpen : desktopCollapsed,
          },
        }}
        padding={inEditor ? 0 : "lg"}
      >
        {!inEditor && (
          <MantineAppShell.Header>
            <AppHeader mobileOpened={mobileOpened} onToggleMobile={toggleMobile} />
          </MantineAppShell.Header>
        )}

        <MantineAppShell.Navbar>
          <AppSidebar onNavigate={closeMobile} />
        </MantineAppShell.Navbar>

        {/* Mounted here (not in the header) so ⌘K also works where the header is hidden. */}
        <SearchSpotlight />

        <MantineAppShell.Main>
          <Outlet />
        </MantineAppShell.Main>
      </MantineAppShell>
    </SidebarControlContext.Provider>
  );
}
