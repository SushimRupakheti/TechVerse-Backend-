import { Router } from "express";
import paymentController from "../controllers/payment.controller";

const router = Router();

// Create Stripe Checkout Session
router.post("/stripe/checkout", (req, res) => paymentController.createStripeCheckout(req, res));

export default router;
