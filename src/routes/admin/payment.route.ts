import { Router } from "express";
import adminPaymentController from "../../controllers/admin/payment.controller";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";

const router = Router();

router.get("/", authorizedMiddleWare, adminMiddleware, (req, res) => adminPaymentController.getAllPayments(req, res));
router.get("/:id", authorizedMiddleWare, adminMiddleware, (req, res) => adminPaymentController.getPaymentById(req, res));

export default router;
