import mongoose, { Document, Schema } from "mongoose";

/**
 * CartItem — individual product entries inside a cart.
 * Equivalent SQL:
 *   CREATE TABLE cart_items (
 *     id            OBJECTID PRIMARY KEY,
 *     cart_id       OBJECTID NOT NULL REFERENCES carts(id),
 *     product_id    OBJECTID NOT NULL REFERENCES items(id),
 *     price_at_time NUMBER NOT NULL,
 *     created_at    TIMESTAMP,
 *     updated_at    TIMESTAMP
 *   );
 */
const cartItemSchema: Schema = new Schema(
  {
    cartId: {
      type: mongoose.Types.ObjectId,
      ref: "Cart",
      required: true,
    },
    productId: {
      type: mongoose.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    priceAtTime: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: a product can appear only once per cart
cartItemSchema.index({ cartId: 1, productId: 1 }, { unique: true });

export interface ICartItem extends Document {
  _id: mongoose.Types.ObjectId;
  cartId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  priceAtTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CartItemModel = mongoose.model<ICartItem>(
  "CartItem",
  cartItemSchema
);
