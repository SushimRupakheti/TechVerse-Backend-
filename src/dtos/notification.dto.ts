import z from "zod";

export const AdminCustomNotificationDto = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
});
export type AdminCustomNotificationDto = z.infer<typeof AdminCustomNotificationDto>;
