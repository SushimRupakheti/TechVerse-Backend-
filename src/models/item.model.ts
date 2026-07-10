import mongoose, { Document, Schema } from "mongoose";
import { ItemType } from "../types/item.type"; 

const itemSchema: Schema = new Schema(
  {
    sellerId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },

    photos: {
      type: [String],
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    phoneModel: {
      type: String,
      required: true,
    },

    itemName: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    finalPrice: {
      type: Number,
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    deviceCondition: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    location: {
      type: String,
    },

    isSold: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "sold"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export interface IItem extends ItemType, Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const ItemModel = mongoose.model<IItem>("Item", itemSchema);
