import { Box } from "@mantine/core";
import type { ReactNode } from "react";

/** Bordered, rounded box that fills the remaining height of a flex column. */
export function EditorFrame({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        border: "1px solid var(--app-border)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
