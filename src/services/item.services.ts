import { ItemModel } from "../models/item.model";
import { CreateItemDTO, UpdateItemDTO } from "../dtos/item.dto";
import { HttpError } from "../errors/http-error";
import mongoose from "mongoose";

export class ItemService {
  async createItem(sellerId: string, data: CreateItemDTO) {
    const item = await ItemModel.create({
      sellerId,
      ...data,
      status: "pending",
    } as any);

    return item;
  }

  async getAllItems(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ItemModel.find()
        .populate("sellerId", "firstName lastName profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ItemModel.countDocuments(),
    ]);

    return { items, total };
  }

  async getItemById(id: string) {
    return await ItemModel.findById(id).populate(
      "sellerId",
      "firstName lastName contactNo"
    );
  }

  async getItemsByUserId(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, "Invalid user id");
    }

    return await ItemModel.find({ sellerId: userId })
      .populate("sellerId", "firstName lastName contactNo profileImage")
      .sort({ createdAt: -1 });
  }

  async updateItem(itemId: string, userId: string, data: UpdateItemDTO) {
    const item = await ItemModel.findById(itemId);
    if (!item) throw new HttpError(404, "Item not found");

    if (item.sellerId.toString() !== userId)
      throw new HttpError(403, "Forbidden: not the owner of the item");

    const updated = await ItemModel.findByIdAndUpdate(itemId, data as any, {
      new: true,
    });

    return updated;
  }

  async deleteItem(itemId: string, userId: string) {
    const item = await ItemModel.findById(itemId);
    if (!item) throw new HttpError(404, "Item not found");

    if (item.sellerId.toString() !== userId)
      throw new HttpError(403, "Forbidden: not the owner of the item");

    const deleted = await ItemModel.findByIdAndDelete(itemId);
    if (!deleted) throw new HttpError(500, "Failed to delete item");

    return deleted;
  }
}
