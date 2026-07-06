import { Router } from "express";
import adminPaymentController from "../../controllers/admin/payment.controller";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";
import { paymentRateLimiter } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get("/", paymentRateLimiter, authorizedMiddleWare, adminMiddleware, (req, res) => adminPaymentController.getAllPayments(req, res));
router.get("/:id", paymentRateLimiter, authorizedMiddleWare, adminMiddleware, (req, res) => adminPaymentController.getPaymentById(req, res));

export default router;
