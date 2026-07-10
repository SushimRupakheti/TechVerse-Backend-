import { Request, Response } from "express";
import { ItemService } from "../services/item.services";
import { HttpError } from "../errors/http-error";
import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";



export class ItemController {
    private itemService: ItemService;

  constructor() {
    this.itemService = new ItemService();
  }
  async createItem(req: Request, res: Response) {
    try {
      if (!req.user)
        throw new HttpError(401, "Unauthorized, User Not Found");

      const parsed = CreateItemDto.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(
          400,
          parsed.error.issues[0]?.message || "Invalid item data"
        );
      }

      const sellerId = req.user._id;

      const item = await this.itemService.createItem(
        sellerId.toString(),
        parsed.data
      );

      return res.status(201).json({
        success: true,
        message: "Item created successfully",
        item,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Item creation failed",
      });
    }
  }

  async getAllItems(req: Request, res: Response) {
    try {
      const items = await this.itemService.getAllItems();

      return res.status(200).json({
        success: true,
        items,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch items",
      });
    }
  }

  async getItemById(req: Request, res: Response) {
    try {
      const item = await this.itemService.getItemById(req.params.id);

      if (!item) throw new HttpError(404, "Item not found");

      return res.status(200).json({
        success: true,
        item,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Failed to fetch item",
      });
    }
  }

  async getItemsByUserId(req: Request, res: Response) {
    try {
      const userId = req.params.userId;

      const items = await this.itemService.getItemsByUserId(userId);

      return res.status(200).json({ success: true, items });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Failed to fetch user's items",
      });
    }
  }

  async updateItem(req: Request, res: Response) {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized, User Not Found");

      const itemId = req.params.id;
      const userId = req.user._id.toString();

      const parsed = UpdateItemDto.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(
          400,
          parsed.error.issues[0]?.message || "Invalid item data"
        );
      }

      const updatedItem = await this.itemService.updateItem(itemId, userId, parsed.data);

      return res.status(200).json({ success: true, item: updatedItem });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Failed to update item",
      });
    }
  }

  async deleteItem(req: Request, res: Response) {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized, User Not Found");

      const itemId = req.params.id;
      const userId = req.user._id.toString();

      await this.itemService.deleteItem(itemId, userId);

      return res.status(200).json({ success: true, message: "Item deleted successfully" });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Failed to delete item",
      });
    }
  }
}
