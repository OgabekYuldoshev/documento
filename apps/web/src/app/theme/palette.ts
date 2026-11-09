import type { MantineColorsTuple } from "@mantine/core";

/** Brand: confident blue-indigo, tuned so shade 6 (light) / 5 (dark) hit AA contrast with white text. */
export const brand: MantineColorsTuple = [
  "#eff3ff",
  "#dde5ff",
  "#bccaff",
  "#99adff",
  "#7b93fb",
  "#6179f5",
  "#4a62e8",
  "#3b4fcf",
  "#3141a8",
  "#263384",
];

/** Cool slate neutrals for dark mode. [7] = canvas (body), [6] = surfaces (paper/inputs), [4] = borders. */
export const dark: MantineColorsTuple = [
  "#e7eaf1",
  "#c3c9d6",
  "#8b94a7",
  "#687186",
  "#2a3140",
  "#202636",
  "#161b25",
  "#0e1118",
  "#0a0c11",
  "#06080b",
];

/** Cool-tinted grays for light mode (borders, subtle fills, dimmed text). */
export const gray: MantineColorsTuple = [
  "#f6f7fb",
  "#eef0f6",
  "#e4e7ef",
  "#d3d8e3",
  "#aab1c2",
  "#7b8399",
  "#5f6980",
  "#475066",
  "#323a4d",
  "#1d2333",
];
