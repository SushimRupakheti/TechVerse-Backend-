import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { AdminCustomNotificationDto } from "../dtos/notification.dto";
import z from "zod";

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * GET /api/notifications
   * Return all notifications for the logged-in user.
   */
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const page = Math.max(Number.parseInt(String(req.query.page || "1"), 10) || 1, 1);
      const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "20"), 10) || 20, 1), 100);
      const { notifications, total } = await notificationService.getNotifications(userId, page, limit);
      return res.status(200).json({
        success: true,
        data: notifications,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read.
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const notificationId = req.params.id;
      const updated = await notificationService.markAsRead(
        userId,
        notificationId
      );

      return res.status(200).json({
        success: true,
        data: updated,
        message: "Notification marked as read",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification.
   */
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?._id?.toString();
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const notificationId = req.params.id;
      await notificationService.deleteNotification(userId, notificationId);

      return res.status(200).json({
        success: true,
        message: "Notification deleted",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  /**
   * POST /api/admin/notifications
   * Admin sends a custom notification to ALL users.
   */
  async sendAdminCustomNotification(req: Request, res: Response) {
    try {
      const parsed = AdminCustomNotificationDto.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsed.error),
        });
      }

      const created = await notificationService.sendAdminCustomToAll(
        parsed.data.title,
        parsed.data.message
      );

      return res.status(201).json({
        success: true,
        data: { count: created.length },
        message: `Notification sent to ${created.length} users`,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
}
