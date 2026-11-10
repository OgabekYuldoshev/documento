import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const next = scheme === "dark" ? "light" : "dark";

  return (
    <Tooltip label={next === "dark" ? "Tungi rejim" : "Kunduzgi rejim"}>
      <ActionIcon
        variant="light"
        color="gray"
        size="lg"
        aria-label="Rejimni almashtirish"
        onClick={() => setColorScheme(next)}
      >
        {scheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
