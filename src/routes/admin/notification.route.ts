import { Router } from "express";
import { NotificationController } from "../../controllers/notification.controller";
import {
  authorizedMiddleWare,
  adminMiddleware,
} from "../../middlewares/authorized.middleware";

const router: Router = Router();
const notificationController = new NotificationController();

// POST /api/admin/notifications — send custom notification to ALL users
router.post(
  "/",
  authorizedMiddleWare,
  adminMiddleware,
  notificationController.sendAdminCustomNotification
);

export default router;
