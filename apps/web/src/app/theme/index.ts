import { createTheme, type MantineColorsTuple, rem } from "@mantine/core";

const brand: MantineColorsTuple = [
  "#eef1ff",
  "#dde2fb",
  "#b9c2f3",
  "#92a0ec",
  "#7081e5",
  "#5a6ee1",
  "#4c63e0",
  "#3d52c7",
  "#3548b2",
  "#2a3d9e",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand },
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: "md",
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  headings: { fontWeight: "700" },
  cursorType: "pointer",
  components: {
    Button: { defaultProps: { fw: 600 } },
    TextInput: { defaultProps: { size: "md" } },
    PasswordInput: { defaultProps: { size: "md" } },
    Select: { defaultProps: { size: "md" } },
    Paper: { defaultProps: { shadow: "xs" } },
    Modal: { styles: { title: { fontWeight: 700, fontSize: rem(18) } } },
  },
});
