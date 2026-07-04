import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";

const router: Router = Router();
const notificationController = new NotificationController();

// All notification routes require authentication
router.use(authorizedMiddleWare);

router.get("/", notificationController.getNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

export default router;
