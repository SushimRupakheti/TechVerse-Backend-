export type NotificationType = {
  user: string;
  title: string;
  message: string;
  type: "APPROVED" | "REJECTED" | "SOLD" | "ADMIN_CUSTOM";
  item?: string | null;
  isRead: boolean;
};
