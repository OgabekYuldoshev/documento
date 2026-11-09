import { Menu } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { useLogout } from "../model/useLogout";

export function LogoutMenuItem() {
  const logout = useLogout();
  return (
    <Menu.Item
      color="red"
      leftSection={<IconLogout size={16} />}
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      Chiqish
    </Menu.Item>
  );
}
