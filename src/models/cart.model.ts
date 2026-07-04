import mongoose, { Document, Schema } from "mongoose";

/**
 * Cart — one per user.
 * Equivalent SQL:
 *   CREATE TABLE carts (
 *     id        OBJECTID PRIMARY KEY,
 *     user_id   OBJECTID NOT NULL REFERENCES users(id) UNIQUE,
 *     created_at TIMESTAMP,
 *     updated_at TIMESTAMP
 *   );
 */
const cartSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // each user has only ONE cart
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

export interface ICart extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const CartModel = mongoose.model<ICart>("Cart", cartSchema);
