import {
  type CSSVariablesResolver,
  createTheme,
  type MantineThemeOverride,
  rem,
} from "@mantine/core";
import { brand, dark, gray } from "./palette";

const FONT =
  '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const theme: MantineThemeOverride = createTheme({
  primaryColor: "brand",
  colors: { brand, dark, gray },
  primaryShade: { light: 6, dark: 5 },
  black: "#101828",
  white: "#ffffff",
  autoContrast: true,
  defaultRadius: "md",
  cursorType: "pointer",
  focusRing: "auto",
  fontFamily: FONT,
  fontFamilyMonospace: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  headings: {
    fontFamily: FONT,
    fontWeight: "650",
    sizes: {
      h1: { fontSize: rem(32), lineHeight: "1.2" },
      h2: { fontSize: rem(26), lineHeight: "1.25" },
      h3: { fontSize: rem(21), lineHeight: "1.3" },
      h4: { fontSize: rem(17), lineHeight: "1.35" },
    },
  },
  radius: { xs: rem(4), sm: rem(6), md: rem(10), lg: rem(14), xl: rem(20) },
  shadows: {
    xs: "0 1px 2px rgba(16, 24, 40, 0.05)",
    sm: "0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)",
    md: "0 4px 12px -2px rgba(16, 24, 40, 0.08), 0 2px 6px -2px rgba(16, 24, 40, 0.05)",
    lg: "0 12px 24px -4px rgba(16, 24, 40, 0.1), 0 4px 8px -2px rgba(16, 24, 40, 0.05)",
    xl: "0 24px 48px -12px rgba(16, 24, 40, 0.2)",
  },
  components: {
    Button: {
      defaultProps: { fw: 600 },
      styles: { root: { transition: "transform 80ms ease, background-color 120ms ease" } },
    },
    ActionIcon: { defaultProps: { radius: "md" } },
    TextInput: {
      defaultProps: { size: "md" },
      styles: { label: { fontWeight: 600, marginBottom: 6 } },
    },
    PasswordInput: {
      defaultProps: { size: "md" },
      styles: { label: { fontWeight: 600, marginBottom: 6 } },
    },
    Select: {
      defaultProps: { size: "md" },
      styles: { label: { fontWeight: 600, marginBottom: 6 } },
    },
    Paper: {
      defaultProps: { radius: "lg" },
      styles: { root: { backgroundColor: "var(--app-surface)" } },
    },
    Popover: { styles: { dropdown: { backgroundColor: "var(--app-surface)" } } },
    Badge: {
      defaultProps: { radius: "xl" },
      styles: { label: { fontWeight: 600, textTransform: "none" } },
    },
    Avatar: { defaultProps: { color: "brand", variant: "light" } },
    ThemeIcon: { defaultProps: { radius: "md" } },
    Tooltip: { defaultProps: { radius: "md", withArrow: true } },
    Menu: {
      defaultProps: { radius: "md", shadow: "lg" },
      styles: { dropdown: { backgroundColor: "var(--app-surface)" } },
    },
    Notification: { defaultProps: { radius: "md" } },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
        overlayProps: { backgroundOpacity: 0.5, blur: 4 },
      },
      styles: {
        title: { fontWeight: 650, fontSize: rem(18) },
        content: { backgroundColor: "var(--app-surface)" },
        header: { backgroundColor: "var(--app-surface)" },
      },
    },
    NavLink: {
      defaultProps: { variant: "light" },
      styles: { root: { fontWeight: 500, padding: "10px 12px" } },
    },
    AppShell: {
      styles: {
        header: { background: "var(--app-surface)", borderColor: "var(--app-border)" },
        navbar: { background: "var(--app-surface)", borderColor: "var(--app-border)" },
        main: { background: "var(--app-canvas)" },
      },
    },
    Table: {
      styles: {
        th: {
          fontSize: rem(12),
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--mantine-color-dimmed)",
          background: "var(--app-subtle)",
        },
      },
    },
  },
});

/** Semantic surface tokens for both schemes; consume with var(--app-*). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--app-canvas": "#f6f7fb",
    "--app-surface": "#ffffff",
    "--app-subtle": "#f9fafc",
    "--app-border": "#e4e7ef",
    "--mantine-color-body": "#f6f7fb",
    "--mantine-color-default-border": "#e4e7ef",
    "--mantine-color-dimmed": "#667085",
  },
  dark: {
    "--app-canvas": "#0e1118",
    "--app-surface": "#161b25",
    "--app-subtle": "#121722",
    "--app-border": "#2a3140",
    "--mantine-color-body": "#0e1118",
    "--mantine-color-default-border": "#2a3140",
    "--mantine-color-dimmed": "#8b94a7",
  },
});
