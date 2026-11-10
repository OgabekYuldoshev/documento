import { Box } from "@mantine/core";
import { Outlet } from "react-router";

/**
 * Chrome-less layout for full-screen tools (the template editor): no app sidebar, the page owns
 * the whole viewport and draws its own top bar.
 */
export function EditorShell() {
  return (
    <Box
      h="100dvh"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--app-canvas)",
      }}
    >
      <Outlet />
    </Box>
  );
}
