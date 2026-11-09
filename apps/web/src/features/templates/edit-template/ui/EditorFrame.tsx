import { Box } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * Bordered, rounded box that fills the remaining height of a flex column.
 * Children are absolutely positioned so percentage heights (CodeMirror) always resolve.
 */
export function EditorFrame({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        border: "1px solid var(--app-border)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
        background: "var(--app-surface)",
      }}
    >
      <Box style={{ position: "absolute", inset: 0 }}>{children}</Box>
    </Box>
  );
}
