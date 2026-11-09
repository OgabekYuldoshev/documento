import { Avatar, Group, Text } from "@mantine/core";
import { getInitials } from "@/shared/lib";

export function UserCell({ name, email }: { name: string; email: string }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Avatar radius="xl" size={36}>
        {getInitials(name)}
      </Avatar>
      <div>
        <Text size="sm" fw={500} lh={1.3}>
          {name}
        </Text>
        <Text size="xs" c="dimmed">
          {email}
        </Text>
      </div>
    </Group>
  );
}
