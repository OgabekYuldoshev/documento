import { IconBraces, IconDatabase, IconFileCode } from "@tabler/icons-react";
import type { ComponentType } from "react";

export type TemplateFile = "source" | "schema" | "sample";

export const TEMPLATE_FILES: {
  id: TemplateFile;
  name: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
}[] = [
  { id: "source", name: "main.typ", icon: IconFileCode },
  { id: "schema", name: "schema.json", icon: IconBraces },
  { id: "sample", name: "namuna.json", icon: IconDatabase },
];
