import {
  ActionIcon,
  type MantineColorScheme,
  Menu,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";

const OPTIONS: { value: MantineColorScheme; label: string; icon: typeof IconSun }[] = [
  { value: "auto", label: "Tizimli", icon: IconDeviceDesktop },
  { value: "dark", label: "Qorong'u", icon: IconMoon },
  { value: "light", label: "Yorug'", icon: IconSun },
];

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });

  return (
    <Menu position="bottom-end" width={170} shadow="md">
      <Menu.Target>
        <ActionIcon variant="light" color="gray" size="lg" aria-label="Rejimni tanlash">
          {computed === "dark" ? <IconMoon size={18} /> : <IconSun size={18} />}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <Menu.Item
            key={value}
            leftSection={<Icon size={16} />}
            rightSection={colorScheme === value ? <IconCheck size={14} /> : null}
            onClick={() => setColorScheme(value)}
          >
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
