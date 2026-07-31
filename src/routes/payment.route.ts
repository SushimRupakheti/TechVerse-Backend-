import { Router } from "express";
import paymentController from "../controllers/payment.controller";
import { paymentRateLimiter } from "../middlewares/rate-limit.middleware";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";

const router = Router();

// Create Stripe Checkout Session
router.post("/stripe/checkout", authorizedMiddleWare, paymentRateLimiter, (req, res) => paymentController.createStripeCheckout(req, res));
router.post("/stripe/confirm", authorizedMiddleWare, paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));
router.get("/stripe/confirm", authorizedMiddleWare, paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));
router.put("/items/:itemId/sold", authorizedMiddleWare, paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));

export default router;
