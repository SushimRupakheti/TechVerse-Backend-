import { CartModel, ICart } from "../models/cart.model";
import { CartItemModel, ICartItem } from "../models/cartItem.model";

export interface ICartRepository {
  findCartByUserId(userId: string): Promise<ICart | null>;
  createCart(userId: string): Promise<ICart>;
  findOrCreateCart(userId: string): Promise<ICart>;
  findCartItemByCartAndProduct(
    cartId: string,
    productId: string
  ): Promise<ICartItem | null>;
  addCartItem(data: Partial<ICartItem>): Promise<ICartItem>;
  getCartItemsWithProducts(cartId: string): Promise<ICartItem[]>;
  findCartItemById(cartItemId: string): Promise<ICartItem | null>;
  removeCartItem(cartItemId: string): Promise<boolean>;
}

export class CartRepository implements ICartRepository {
  async findCartByUserId(userId: string) {
    return await CartModel.findOne({ userId });
  }

  async createCart(userId: string) {
    const cart = new CartModel({ userId });
    await cart.save();
    return cart;
  }

  async findOrCreateCart(userId: string): Promise<ICart> {
    let cart = await this.findCartByUserId(userId);
    if (!cart) {
      cart = await this.createCart(userId);
    }
    return cart;
  }

  async findCartItemByCartAndProduct(cartId: string, productId: string) {
    return await CartItemModel.findOne({ cartId, productId });
  }

  async addCartItem(data: Partial<ICartItem>) {
    const cartItem = new CartItemModel(data);
    await cartItem.save();
    return cartItem;
  }

  /**
   * Fetches cart items with populated product details (SQL JOIN equivalent).
   */
  async getCartItemsWithProducts(cartId: string) {
    return await CartItemModel.find({ cartId })
      .populate({
        path: "productId",
        select:
          "phoneModel itemName category finalPrice price photos isSold status description",
      })
      .sort({ createdAt: -1 });
  }

  async findCartItemById(cartItemId: string) {
    return await CartItemModel.findById(cartItemId);
  }

  async removeCartItem(cartItemId: string) {
    const result = await CartItemModel.findByIdAndDelete(cartItemId);
    return result ? true : false;
  }
}
