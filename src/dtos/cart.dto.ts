import z from "zod";

export const AddToCartDto = z.object({
  productId: z.string().min(1, "Product ID is required"),
});
export type AddToCartDto = z.infer<typeof AddToCartDto>;
