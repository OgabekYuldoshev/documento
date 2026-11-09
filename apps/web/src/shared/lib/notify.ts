import { notifications } from "@mantine/notifications";

export const notify = {
  success: (message: string, title = "Success") =>
    notifications.show({ title, message, color: "teal" }),
  error: (message: string, title = "Error") => notifications.show({ title, message, color: "red" }),
};
