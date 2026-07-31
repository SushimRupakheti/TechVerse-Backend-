import { Request, Response } from "express";
import { CartService } from "../services/cart.service";
import { AddToCartDto } from "../dtos/cart.dto";
import z from "zod";

const cartService = new CartService();

export class CartController {
  /**
   * POST /api/cart/add
   * Add product to cart. If product already exists, returns error.
   */
  async addToCart(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const parsed = AddToCartDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsed.error),
        });
      }

      const cartItem = await cartService.addToCart(userId, parsed.data);
      return res.status(201).json({
        success: true,
        data: cartItem,
        message: "Product added to cart",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  /**
   * GET /api/cart
   * Return all cart items for the logged-in user.
   */
  async getCart(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const result = await cartService.getCartItems(userId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  /**
   * DELETE /api/cart/remove/:id
   * Remove a specific cart item.
   */
  async removeCartItem(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const cartItemId = req.params.id;
      if (!cartItemId) {
        return res.status(400).json({
          success: false,
          message: "Cart item ID is required",
        });
      }

      await cartService.removeCartItem(userId, cartItemId);
      return res.status(200).json({
        success: true,
        message: "Cart item removed",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
}
