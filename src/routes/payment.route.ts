import { Router } from "express";
import paymentController from "../controllers/payment.controller";
import { paymentRateLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();

// Create Stripe Checkout Session
router.post("/stripe/checkout", paymentRateLimiter, (req, res) => paymentController.createStripeCheckout(req, res));
router.post("/stripe/confirm", paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));
router.get("/stripe/confirm", paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));
router.put("/items/:itemId/sold", paymentRateLimiter, (req, res) => paymentController.confirmStripePayment(req, res));

export default router;
