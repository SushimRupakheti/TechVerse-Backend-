import z from "zod";
import { sanitizeUserText } from "../utils/xss-sanitizer";

const safeNotificationText = (field: string, max: number) =>
  z
    .string({ message: `${field} must be a string` })
    .transform((value) => sanitizeUserText(value))
    .refine((value) => value.length > 0, `${field} is required`)
    .refine((value) => value.length <= max, `${field} must be at most ${max} characters`);

export const AdminCustomNotificationDto = z
  .object({
    title: safeNotificationText("Title", 120),
    message: safeNotificationText("Message", 1000),
  })
  .strict();
export type AdminCustomNotificationDto = z.infer<typeof AdminCustomNotificationDto>;
