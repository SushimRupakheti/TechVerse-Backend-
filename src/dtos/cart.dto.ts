import z from "zod";

export const AddToCartDto = z.object({
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Product ID must be a valid identifier"),
}).strict();
export type AddToCartDto = z.infer<typeof AddToCartDto>;
