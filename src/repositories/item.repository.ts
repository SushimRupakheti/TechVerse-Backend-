import { IItem, ItemModel } from "../models/item.model";

export interface IItemRepository {
  createItem(data: Partial<IItem>): Promise<IItem>;
  getItemById(id: string): Promise<IItem | null>;
  getAllItems(): Promise<IItem[]>;
  getItemsBySellerId(sellerId: string): Promise<IItem[]>;
  updateItemById(id: string, data: Partial<IItem>): Promise<IItem | null>;
  markItemSold(id: string): Promise<IItem | null>;
  deleteItemById(id: string): Promise<boolean>;
}

export class ItemRepository implements IItemRepository {
  async createItem(data: Partial<IItem>) {
    const newItem = new ItemModel(data);
    await newItem.save();
    return newItem;
  }

  async getItemById(id: string) {
    return await ItemModel.findById(id).populate(
      "sellerId",
      "firstName lastName contactNo profileImage"
    );
  }

  async getAllItems() {
    return await ItemModel.find()
      .populate("sellerId", "firstName lastName profileImage")
      .sort({ createdAt: -1 });
  }

  async getItemsBySellerId(sellerId: string) {
    return await ItemModel.find({ sellerId })
      .populate("sellerId", "firstName lastName profileImage")
      .sort({ createdAt: -1 });
  }

  async updateItemById(id: string, data: Partial<IItem>) {
    const updated = await ItemModel.findByIdAndUpdate(id, data, { new: true });
    return updated;
  }

  async markItemSold(id: string) {
    const updated = await ItemModel.findByIdAndUpdate(
      id,
      { isSold: true },
      { new: true }
    );
    return updated;
  }

  async deleteItemById(id: string) {
    const result = await ItemModel.findByIdAndDelete(id);
    return result ? true : false;
  }
}
