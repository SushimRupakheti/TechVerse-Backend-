import { NotificationRepository } from "../repositories/notification.repository";
import { UserRepository } from "../repositories/auth.repository";
import { HttpError } from "../errors/http-error";
import mongoose from "mongoose";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

export class NotificationService {
  // ────────────────────────────────────────────
  //  User-facing methods
  // ────────────────────────────────────────────

  /**
   * Get all notifications for the authenticated user (newest first).
   */
  async getNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total] = await Promise.all([
      notificationRepository.findByUserId(userId, (page - 1) * limit, limit),
      notificationRepository.countByUserId(userId),
    ]);
    return { notifications, total };
  }

  /**
   * Mark a notification as read.
   * Ensures the notification belongs to the requesting user.
   */
  async markAsRead(userId: string, notificationId: string) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new HttpError(400, "Invalid notification ID");
    }

    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }

    if (notification.user.toString() !== userId) {
      throw new HttpError(403, "You can only update your own notifications");
    }

    return await notificationRepository.markAsRead(notificationId);
  }

  /**
   * Delete a notification.
   * Ensures the notification belongs to the requesting user.
   */
  async deleteNotification(userId: string, notificationId: string) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new HttpError(400, "Invalid notification ID");
    }

    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }

    if (notification.user.toString() !== userId) {
      throw new HttpError(403, "You can only delete your own notifications");
    }

    const removed = await notificationRepository.deleteById(notificationId);
    if (!removed) {
      throw new HttpError(500, "Failed to delete notification");
    }
    return true;
  }

  // ────────────────────────────────────────────
  //  Admin: send custom notification to ALL users
  // ────────────────────────────────────────────

  async sendAdminCustomToAll(title: string, message: string) {
    const allUsers = await userRepository.getAllUsers();
    if (!allUsers || allUsers.length === 0) {
      throw new HttpError(404, "No users found");
    }

    const docs = allUsers.map((user) => ({
      user: user._id,
      title,
      message,
      type: "ADMIN_CUSTOM" as const,
      item: null,
      isRead: false,
    }));

    const created = await notificationRepository.createMany(docs);
    return created;
  }

  // ────────────────────────────────────────────
  //  Automatic trigger helpers (called from other controllers/services)
  // ────────────────────────────────────────────

  /**
   * Notify seller when their product is approved.
   */
  static async notifyProductApproved(
    sellerId: string,
    productId: string,
    productName: string
  ) {
    try {
      const repo = new NotificationRepository();
      await repo.create({
        user: new mongoose.Types.ObjectId(sellerId),
        title: "Product Approved",
        message: `Your item '${productName}' has been approved by admin.`,
        type: "APPROVED",
        item: new mongoose.Types.ObjectId(productId),
      });
    } catch (err) {
      console.error("Failed to create APPROVED notification:", err);
    }
  }

  /**
   * Notify seller when their product is rejected.
   */
  static async notifyProductRejected(
    sellerId: string,
    productId: string,
    productName: string
  ) {
    try {
      const repo = new NotificationRepository();
      await repo.create({
        user: new mongoose.Types.ObjectId(sellerId),
        title: "Product Rejected",
        message: `Your item '${productName}' has been rejected by admin.`,
        type: "REJECTED",
        item: new mongoose.Types.ObjectId(productId),
      });
    } catch (err) {
      console.error("Failed to create REJECTED notification:", err);
    }
  }

  /**
   * Notify seller when their product is sold.
   */
  static async notifyProductSold(
    sellerId: string,
    productId: string,
    productName: string
  ) {
    try {
      const repo = new NotificationRepository();
      await repo.create({
        user: new mongoose.Types.ObjectId(sellerId),
        title: "Item Sold",
        message: `Your item '${productName}' has been sold.`,
        type: "SOLD",
        item: new mongoose.Types.ObjectId(productId),
      });
    } catch (err) {
      console.error("Failed to create SOLD notification:", err);
    }
  }
}
