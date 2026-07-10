import { Request, Response } from "express";
import { ItemModel } from "../../models/item.model";
import mongoose from "mongoose";
import { NotificationService } from "../../services/notification.service";
import { AdminUpdateItemDto } from "../../dtos/item.dto";

export class AdminItemController {
  async getAllItems(req: Request, res: Response) {
    try {
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const limit = 10;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        ItemModel.find()
          .populate("sellerId", "firstName lastName profileImage")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ItemModel.countDocuments(),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.status(200).json({
        success: true,
        message: "Items fetched successfully",
        data: items,
        meta: {
          total,
          totalPages,
          currentPage: page,
          perPage: limit,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error fetching items" });
    }
  }

  async getItemById(req: Request, res: Response) {
    try {
      const { itemid } = req.params;

      if (!mongoose.Types.ObjectId.isValid(itemid)) {
        return res.status(400).json({ success: false, message: "Invalid item id" });
      }

      const item = await ItemModel.findById(itemid).populate(
        "sellerId",
        "firstName lastName contactNo profileImage"
      );

      if (!item) return res.status(404).json({ success: false, message: "Item not found" });

      return res.status(200).json({ success: true, item });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error fetching item" });
    }
  }

  async updateItem(req: Request, res: Response) {
    try {
      const { itemid } = req.params;

      if (!mongoose.Types.ObjectId.isValid(itemid)) {
        return res.status(400).json({ success: false, message: "Invalid item id" });
      }

      const parsed = AdminUpdateItemDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || "Invalid item data",
        });
      }

      const updated = await ItemModel.findByIdAndUpdate(itemid, parsed.data as any, { new: true });

      if (!updated) return res.status(404).json({ success: false, message: "Item not found" });

      // ── Auto-trigger notification if status was changed via generic update ──
      const bodyStatus = parsed.data.status;
      if (bodyStatus && updated.sellerId) {
        const sellerIdStr = updated.sellerId.toString();
        const productName = (updated as any).phoneModel || "your item";

        if (bodyStatus === "approved") {
          await NotificationService.notifyProductApproved(sellerIdStr, itemid, productName);
        } else if (bodyStatus === "rejected") {
          await NotificationService.notifyProductRejected(sellerIdStr, itemid, productName);
        }
      }

      return res.status(200).json({ success: true, message: "Item updated successfully", item: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error updating item" });
    }
  }

  async deleteItem(req: Request, res: Response) {
    try {
      const { itemid } = req.params;

      if (!mongoose.Types.ObjectId.isValid(itemid)) {
        return res.status(400).json({ success: false, message: "Invalid item id" });
      }

      const deleted = await ItemModel.findByIdAndDelete(itemid);

      if (!deleted) return res.status(404).json({ success: false, message: "Item not found" });

      return res.status(200).json({ success: true, message: "Item deleted successfully" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error deleting item" });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { itemid } = req.params;

      if (!mongoose.Types.ObjectId.isValid(itemid)) {
        return res.status(400).json({ success: false, message: "Invalid item id" });
      }

      const { status } = req.body as { status?: string };
      const allowed = ["pending", "approved", "rejected"];

      if (!status || !allowed.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status. Allowed: pending, approved, rejected" });
      }

      const update: any = { status };
      if (status === "approved") {
        update.approvedBy = (req.user as any)?._id || null;
        update.approvedAt = new Date();
      } else {
        update.approvedBy = null;
        update.approvedAt = null;
      }

      const updated = await ItemModel.findByIdAndUpdate(itemid, update as any, { new: true });

      if (!updated) return res.status(404).json({ success: false, message: "Item not found" });

      // ── Auto-trigger notification to seller ──
      if (updated.sellerId) {
        const sellerIdStr = updated.sellerId.toString();
        const productName = (updated as any).phoneModel || "your item";

        if (status === "approved") {
          await NotificationService.notifyProductApproved(
            sellerIdStr,
            itemid,
            productName
          );
        } else if (status === "rejected") {
          await NotificationService.notifyProductRejected(
            sellerIdStr,
            itemid,
            productName
          );
        }
      }

      return res.status(200).json({ success: true, message: "Item status updated", item: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error updating status" });
    }
  }
}
