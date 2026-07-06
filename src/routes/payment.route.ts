import { Router } from "express";
import paymentController from "../controllers/payment.controller";
import { paymentRateLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();

// Create Stripe Checkout Session
router.post("/stripe/checkout", paymentRateLimiter, (req, res) => paymentController.createStripeCheckout(req, res));

export default router;
