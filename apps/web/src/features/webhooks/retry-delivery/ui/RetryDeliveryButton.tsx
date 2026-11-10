import { ActionIcon, Tooltip } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateWebhookQueries } from "../../invalidate";

type Props = { projectId: string; deliveryId: string };

export function RetryDeliveryButton({ projectId, deliveryId }: Props) {
  const retry = useMutation({
    ...trpc.webhooks.retry.mutationOptions(),
    onSuccess: async () => {
      await invalidateWebhookQueries();
      notify.success("Qayta yuborish navbatga qo'yildi");
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  return (
    <Tooltip label="Qayta yuborish">
      <ActionIcon
        variant="subtle"
        loading={retry.isPending}
        onClick={() => retry.mutate({ projectId, deliveryId })}
        aria-label="Qayta yuborish"
      >
        <IconRefresh size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
