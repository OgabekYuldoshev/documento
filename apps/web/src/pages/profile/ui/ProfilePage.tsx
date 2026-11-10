import { Center, Loader, Stack, Tabs } from "@mantine/core";
import { IconKey, IconUser } from "@tabler/icons-react";
import { useSearchParams } from "react-router";
import { useSession } from "@/entities/session";
import { ChangePasswordForm } from "@/features/account/change-password";
import { ProfileForm } from "@/features/account/update-profile";
import { PageHeader } from "@/shared/ui";

const TABS = ["profile", "password"] as const;
type Tab = (typeof TABS)[number];

export function ProfilePage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = TABS.find((t) => t === requested) ?? "profile";

  if (!user) {
    return (
      <Center mih="40dvh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap={0}>
      <PageHeader title="Hisob" description="Shaxsiy ma'lumot va xavfsizlik sozlamalari." />
      <Tabs
        value={tab}
        keepMounted={false}
        onChange={(value) =>
          setParams(value && value !== "profile" ? { tab: value } : {}, { replace: true })
        }
      >
        <Tabs.List mb="lg">
          <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
            Profil
          </Tabs.Tab>
          <Tabs.Tab value="password" leftSection={<IconKey size={16} />}>
            Parol
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="profile">
          <ProfileForm user={user} />
        </Tabs.Panel>
        <Tabs.Panel value="password">
          <ChangePasswordForm />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
