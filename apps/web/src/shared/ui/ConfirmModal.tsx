import { Button, Group, Modal, Text } from "@mantine/core";

type ConfirmModalProps = {
  opened: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  color?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  opened,
  title,
  message,
  confirmLabel = "Tasdiqlash",
  color = "red",
  loading,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text size="sm">{message}</Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Bekor qilish
        </Button>
        <Button color={color} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
