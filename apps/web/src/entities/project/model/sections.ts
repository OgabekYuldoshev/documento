import { IconFileCheck, IconKey, IconSettings, IconTemplate, IconUsers } from "@tabler/icons-react";
import type { ComponentType } from "react";

export type ProjectSection = "templates" | "documents" | "keys" | "members" | "settings";

/** Project areas: shown as page tabs and as sidebar shortcuts under the active project. */
export const PROJECT_SECTIONS: {
  value: ProjectSection;
  label: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
}[] = [
  { value: "templates", label: "Shablonlar", icon: IconTemplate },
  { value: "documents", label: "Hujjatlar", icon: IconFileCheck },
  { value: "keys", label: "API keylar", icon: IconKey },
  { value: "members", label: "A'zolar", icon: IconUsers },
  { value: "settings", label: "Sozlamalar", icon: IconSettings },
];

export const DEFAULT_SECTION: ProjectSection = "templates";

/** Reads the `?tab=` value; anything unknown falls back to the default section. */
export const parseSection = (value: string | null): ProjectSection =>
  PROJECT_SECTIONS.find((s) => s.value === value)?.value ?? DEFAULT_SECTION;

/** URL of a project section (the default one has a clean URL). */
export const projectSectionPath = (basePath: string, section: ProjectSection) =>
  section === DEFAULT_SECTION ? basePath : `${basePath}?tab=${section}`;
