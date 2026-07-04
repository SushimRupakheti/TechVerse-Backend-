import z from "zod";

export const CreateItemDto = z
  .object({
    photos: z.array(z.string()).min(1, "At least one photo is required"),
    category: z.string().min(1),
    phoneModel: z.string().min(1),
    itemName: z.string().min(1),
    year: z.coerce.number().int(),
    deviceCondition: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number(),
    finalPrice: z.coerce.number(),
  })
  .strict();

export type CreateItemDTO = z.infer<typeof CreateItemDto>;

