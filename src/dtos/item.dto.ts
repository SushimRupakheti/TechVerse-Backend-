import z from "zod";
import { sanitizeUserText } from "../utils/xss-sanitizer";

const sanitizedText = (field: string, max: number, rejectEmpty = true) =>
  z
    .string({ message: `${field} must be a string` })
    .transform((value) => sanitizeUserText(value))
    .refine((value) => !rejectEmpty || value.length > 0, `${field} is required`)
    .refine((value) => value.length <= max, `${field} must be at most ${max} characters`);

const photoUrl = z
  .string({ message: "Photo URL must be a string" })
  .trim()
  .min(1, "Photo URL is required")
  .max(500, "Photo URL is too long");

export const CreateItemDto = z
  .object({
    photos: z.array(photoUrl).min(1, "At least one photo is required").max(5, "At most 5 photos are allowed"),
    category: sanitizedText("Category", 100),
    phoneModel: sanitizedText("Phone model", 150),
    itemName: sanitizedText("Title", 150),
    location: sanitizedText("Location", 200).optional(),
    year: z.coerce.number().int(),
    deviceCondition: sanitizedText("Device condition", 100),
    description: sanitizedText("Description", 3000),
    price: z.coerce.number(),
    finalPrice: z.coerce.number(),
  })
  .strict();

export const UpdateItemDto = CreateItemDto.partial().strict();

export const AdminUpdateItemDto = UpdateItemDto.extend({
  status: z.enum(["pending", "approved", "rejected", "sold"]).optional(),
  isSold: z.boolean().optional(),
}).strict();

export type CreateItemDTO = z.infer<typeof CreateItemDto>;
export type UpdateItemDTO = z.infer<typeof UpdateItemDto>;
export type AdminUpdateItemDTO = z.infer<typeof AdminUpdateItemDto>;