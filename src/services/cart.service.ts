import { CartRepository } from "../repositories/cart.repository";
import { ItemRepository } from "../repositories/item.repository";
import { HttpError } from "../errors/http-error";
import { AddToCartDto } from "../dtos/cart.dto";

const cartRepository = new CartRepository();
const itemRepository = new ItemRepository();

export class CartService {
  /**
   * Add a product to the user's cart.
   * - Validates product existence.
   * - Creates cart if it doesn't exist.
   * - If product already in cart, returns existing item.
   * - Stores finalPrice as priceAtTime.
   */
  async addToCart(userId: string, data: AddToCartDto) {
    // 1. Validate product exists
    const product = await itemRepository.getItemByIdRaw(data.productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }

    if (product.isSold || product.status === "sold") {
      throw new HttpError(409, "Sold items cannot be added to a cart");
    }

    if (product.status !== "approved") {
      throw new HttpError(400, "Only approved items can be added to a cart");
    }

    // 1.5 Prevent seller from buying their own item
    const productSeller = product.sellerId as any;
    const sellerId = productSeller?._id
      ? productSeller._id.toString()
      : productSeller?.toString();

    if (!sellerId) {
      throw new HttpError(400, "Product seller information is missing");
    }

    if (sellerId === userId) {
      throw new HttpError(400, "You cannot buy your own item.");
    }

    // 2. Find or create cart for user
    const cart = await cartRepository.findOrCreateCart(userId);

    // 3. Check if product already exists in cart
    const existingItem = await cartRepository.findCartItemByCartAndProduct(
      cart._id.toString(),
      data.productId
    );

    if (existingItem) {
      throw new HttpError(409, "Product already in cart");
    }

    // 4. Store product price at time of adding
    const priceAtTime = Number(product.finalPrice);
    if (!Number.isFinite(priceAtTime) || priceAtTime <= 0) {
      throw new HttpError(400, "Product has an invalid price");
    }

    // 5. Create new cart item
    const cartItem = await cartRepository.addCartItem({
      cartId: cart._id,
      productId: product._id,
      priceAtTime,
    });

    return cartItem;
  }

  /**
   * Get all cart items for the authenticated user.
   * Uses populate (SQL JOIN equivalent) to include product details.
   */
  async getCartItems(userId: string) {
    const cart = await cartRepository.findCartByUserId(userId);
    if (!cart) {
      return { cart: null, items: [], itemCount: 0, totalPrice: 0 };
    }

    const items = await cartRepository.getCartItemsWithProducts(
      cart._id.toString()
    );

    // Calculate total price
    const totalPrice = Number(
      items.reduce((sum, item) => sum + item.priceAtTime, 0).toFixed(2)
    );

    return { cart, items, itemCount: items.length, totalPrice };
  }

  /**
   * Remove a specific cart item.
   * Validates ownership (cart item belongs to user's cart).
   */
  async removeCartItem(userId: string, cartItemId: string) {
    // 1. Verify user has a cart
    const cart = await cartRepository.findCartByUserId(userId);
    if (!cart) {
      throw new HttpError(404, "Cart not found");
    }

    // 2. Find the cart item
    const cartItem = await cartRepository.findCartItemById(cartItemId);
    if (!cartItem) {
      throw new HttpError(404, "Cart item not found");
    }

    // 3. Verify the cart item belongs to the user's cart
    if (cartItem.cartId.toString() !== cart._id.toString()) {
      throw new HttpError(403, "You can only remove your own cart items");
    }

    // 4. Remove
    const removed = await cartRepository.removeCartItem(cartItemId);
    if (!removed) {
      throw new HttpError(500, "Failed to remove cart item");
    }

    return true;
  }
}
