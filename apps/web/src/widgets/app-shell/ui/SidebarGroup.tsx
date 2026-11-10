import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

/** A captioned sidebar section; rows inside are tightly stacked. */
export function SidebarGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Stack gap={1}>
      {title && (
        <Text
          px={10}
          pb={4}
          fz={11}
          fw={600}
          c="dimmed"
          tt="uppercase"
          style={{ letterSpacing: "0.06em" }}
        >
          {title}
        </Text>
      )}
      {children}
    </Stack>
  );
}
