// File: payment.controller.ts  (replace your existing file contents with this)
import { Request, Response } from "express";
import Stripe from "stripe";
import { StripePaymentModel } from "../models/stripePayment.model";
import { PaymentModel } from "../models/payment.model";
import { ItemModel } from "../models/item.model";
import { NotificationService } from "../services/notification.service";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripePublishable =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  process.env.STRIPE_PUBLISHABLE_KEY ||
  "";

// Payment logging control: set `PAYMENT_SILENT=true` in env to suppress
// all console output from payment-related code (webhooks, controllers).
const PAYMENT_SILENT = process.env.PAYMENT_SILENT === "true";
const paymentConsole = {
  log: (...args: any[]) => {
    if (!PAYMENT_SILENT) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (!PAYMENT_SILENT) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (!PAYMENT_SILENT) console.error(...args);
  },
};

if (!stripeSecret || !stripeSecret.startsWith("sk_")) {
  // Dev-time friendly error — ensures we catch misconfiguration early.
  paymentConsole.error("Invalid STRIPE_SECRET_KEY. It must be the secret key (sk_...)");
  // Note: we don't throw here so the server can still start in some setups;
  // the handler below will return a 500 with a clear message when called.
}

const stripe = new Stripe(stripeSecret || "sk_undefined", {} as Stripe.StripeConfig);

export class PaymentController {
  async createStripeCheckout(req: Request, res: Response) {
    if (!stripeSecret || !stripeSecret.startsWith("sk_")) {
      paymentConsole.error("Stripe secret key missing or invalid on createStripeCheckout.");
      return res.status(500).json({
        error: "Server misconfigured: STRIPE_SECRET_KEY must be set to Stripe secret key (sk_...).",
      });
    }

    try {
      // Diagnostic log of incoming payload
      paymentConsole.log("Incoming /stripe/checkout body:", req.body);

      // Resolve email from several possible incoming keys
      const buyerEmailRaw = req.body.buyerEmail ?? req.body.customerEmail ?? req.body.email ?? "";
      const buyerEmail = (buyerEmailRaw || "").toString().trim() || undefined;

      const {
        amount,
        productName,
        productId,
        buyerName,
        buyerPhone,
        orderId,
        fullName,
        phoneNo,
        phoneModel,
        sellerId,
        price,
        location,
        date,
        time,
        oid,
        refId,
        metadata = {},
        flow,
      } = req.body;

      const origin =
        (req.headers.origin as string) ||
        process.env.NEXT_PUBLIC_APP_ORIGIN ||
        "http://localhost:3000";

      const amountNum = Number(amount || price || 0);
      if (!amountNum || amountNum <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Prevent seller from buying their own item
      if (productId) {
        const product = await ItemModel.findById(productId);
        if (product) {
          const buyerId = (req as any).user?._id?.toString() || (req as any).user?.id;
          if (buyerId && product.sellerId.toString() === buyerId) {
            return res.status(400).json({ error: "You cannot buy your own item." });
          }
        }
      }

      const amountForStripe = Math.round(amountNum * 100);

      // Ensure metadata.email is present for downstream webhook logic
      const mergedMetadata = {
        ...(metadata || {}),
        email: (metadata && (metadata.email || metadata.CustomerEmail)) || buyerEmail || "",
      };

      if (flow === "payment_intent") {
        paymentConsole.log("Creating PaymentIntent with receipt_email:", buyerEmail, "metadata.email:", mergedMetadata.email);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountForStripe,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          receipt_email: buyerEmail,
          metadata: {
            orderId: orderId || "",
            productId: productId || "",
            buyerName: buyerName || "",
            buyerPhone: buyerPhone || "",
            fullName: fullName || buyerName || "",
            phoneNo: phoneNo || buyerPhone || "",
            phoneModel: phoneModel || "",
            sellerId: sellerId || "",
            price: price || amountNum,
            location: location || "",
            date: date || new Date().toISOString().split("T")[0],
            time: time || new Date().toLocaleTimeString(),
            oid: oid || orderId || "",
            refId: refId || orderId || "",
            email: mergedMetadata.email || "",
            ...mergedMetadata,
          },
        });

        paymentConsole.log("Created PaymentIntent:", { id: paymentIntent.id, receipt_email: paymentIntent.receipt_email });
        return res.status(200).json({
          clientSecret: paymentIntent.client_secret,
          publishableKey: stripePublishable,
          amount: amountForStripe,
          currency: paymentIntent.currency,
        });
      }

      paymentConsole.log("Creating Checkout Session with customer_email:", buyerEmail, "metadata.email:", mergedMetadata.email);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: productName || "Product",
                description: `Order ID: ${orderId || productId || "N/A"}`,
              },
              unit_amount: amountForStripe,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/stripe/cancel?order_id=${encodeURIComponent(orderId || productId || "")}`,
        customer_email: buyerEmail || undefined,
        metadata: {
          orderId: orderId || "",
          productId: productId || "",
          buyerName: buyerName || "",
          buyerPhone: buyerPhone || "",
          fullName: fullName || buyerName || "",
          phoneNo: phoneNo || buyerPhone || "",
          phoneModel: phoneModel || "",
          sellerId: sellerId || "",
          price: price || amountNum,
          location: location || "",
          date: date || new Date().toISOString().split("T")[0],
          time: time || new Date().toLocaleTimeString(),
          oid: oid || orderId || "",
          refId: refId || orderId || "",
          email: mergedMetadata.email || "",
          ...mergedMetadata,
        },
      });

      paymentConsole.log("Created Checkout Session:", { id: session.id, customer_email: session.customer_email });
      return res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      paymentConsole.error("Stripe checkout error:", error);
      return res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  }

  // Stripe webhook handler — expects raw body (register route with express.raw middleware)
  async handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: Stripe.Event;
    try {
      const rawBody = req.body as Buffer;
      // Diagnostic logs to help debug webhook receipts and body parsing issues
      try {
        const bodyType = Buffer.isBuffer(rawBody) ? 'Buffer' : typeof rawBody;
        paymentConsole.log(`Stripe webhook received. signature present=${Boolean(sig)}, webhookSecretConfigured=${Boolean(webhookSecret)}, bodyType=${bodyType}`);
        if (Buffer.isBuffer(rawBody)) paymentConsole.log(`Raw body length=${rawBody.length}`);
      } catch (_) {}
      // If webhook secret is not configured, allow a test-mode where the
      // incoming JSON payload is used directly (useful for local testing).
      if (!webhookSecret) {
        try {
          const parsed = JSON.parse(rawBody.toString());
          paymentConsole.warn(
            "STRIPE_WEBHOOK_SECRET not set — processing webhook without signature verification (TEST MODE)."
          );
          event = parsed as Stripe.Event;
        } catch (parseErr: any) {
          throw new Error("Invalid JSON payload for webhook");
        }
      } else {
        if (!sig) throw new Error("Missing stripe-signature header");
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      }
    } catch (err: any) {
      paymentConsole.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle events
    try {
      // Log event type early for visibility
      try { paymentConsole.log(`Stripe event parsed: type=${event.type}`); } catch (_) {}

      // Helper to resolve best-effort email from Stripe objects (payment intent / session / charge)
      const resolveEmail = async (obj: any): Promise<string | null> => {
        if (!obj) return null;
        try {
          // charges.data[0].billing_details.email
          const byCharge = obj.charges?.data?.[0]?.billing_details?.email;
          if (byCharge) return byCharge;

          // receipt_email on PaymentIntent
          if (obj.receipt_email) return obj.receipt_email;

          // session.customer_email (for checkout session)
          if (obj.customer_email) return obj.customer_email;

          // metadata email
          if (obj.metadata && obj.metadata.email) return obj.metadata.email;

          // customer lookup if customer id/object present
          const cust = obj.customer;
          let custId: string | undefined;
          if (cust) {
            if (typeof cust === 'string') custId = cust;
            else if (typeof cust === 'object' && cust.id) custId = cust.id;
          }
          if (custId) {
            try {
              const customer = (await stripe.customers.retrieve(custId)) as any;
              if (customer && customer.email) return customer.email;
            } catch (_) {
              // ignore lookup errors
            }
          }
        } catch (_) {}
        return null;
      };
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          paymentConsole.log("Checkout session completed:", session.id);
          try {
            const sessionPaymentIntentId =
              typeof session.payment_intent === "string" ? session.payment_intent : undefined;
            const matchConditions: any[] = [{ sessionId: session.id }];
            if (sessionPaymentIntentId) {
              matchConditions.push({ paymentIntentId: sessionPaymentIntentId });
            }

            const existing = await StripePaymentModel.findOne({ $or: matchConditions });
            const meta = session.metadata || {};
            const productId = (meta.productId as string) || undefined;
            const orderId = (meta.orderId as string) || undefined;
            const buyerName = (meta.buyerName as string) || undefined;
            const buyerPhone = (meta.buyerPhone as string) || undefined;

            // attempt to fetch item snapshot
            let itemSnapshot = null;
            if (productId) {
              try {
                const item = await ItemModel.findById(productId).lean();
                if (item) {
                  itemSnapshot = item;
                  if (!existing) {
                    try {
                      await ItemModel.updateOne(
                        { _id: productId },
                        { $set: { isSold: true, status: "sold" } }
                      );
                      // Notify seller that their item was sold
                      const sellerId = (item as any).sellerId?.toString();
                      const productName = (item as any).phoneModel || "your item";
                      if (sellerId) {
                        await NotificationService.notifyProductSold(sellerId, productId, productName);
                      }
                    } catch (markErr: any) {
                      paymentConsole.error("Failed to mark item as sold:", markErr);
                    }
                  }
                }
              } catch (itmErr: any) {
                paymentConsole.error("Failed to load item for payment snapshot:", itmErr);
              }
            }

            const resolvedEmail = await resolveEmail(session);
            const stripePaymentDoc = {
              sessionId: session.id,
              paymentIntentId: sessionPaymentIntentId,
              amount: session.amount_total ? Number(session.amount_total) / 100 : 0,
              currency: session.currency || "usd",
              customerEmail: resolvedEmail || session.customer_email || "",
              metadata: meta,
              productId,
              orderId,
              buyerName,
              buyerPhone,
              itemSnapshot,
              status: "completed",
              raw: session,
            };

            if (existing) {
              const updateDoc: any = {
                status: "completed",
                raw: session,
              };

              if (!existing.sessionId) updateDoc.sessionId = session.id;
              if (!existing.paymentIntentId && sessionPaymentIntentId) {
                updateDoc.paymentIntentId = sessionPaymentIntentId;
              }
              if (!existing.itemSnapshot && itemSnapshot) updateDoc.itemSnapshot = itemSnapshot;
              if (!existing.customerEmail && stripePaymentDoc.customerEmail) {
                updateDoc.customerEmail = stripePaymentDoc.customerEmail;
              }
              if (!existing.productId && productId) updateDoc.productId = productId;
              if (!existing.orderId && orderId) updateDoc.orderId = orderId;
              if (!existing.buyerName && buyerName) updateDoc.buyerName = buyerName;
              if (!existing.buyerPhone && buyerPhone) updateDoc.buyerPhone = buyerPhone;

              const updated = await StripePaymentModel.findByIdAndUpdate(
                existing._id,
                { $set: updateDoc },
                { new: true }
              );
              paymentConsole.log(
                "Updated existing StripePaymentModel (session):",
                updated?._id?.toString ? updated._id.toString() : updated?._id
              );
            } else {
              const created = await StripePaymentModel.create(stripePaymentDoc);

              paymentConsole.log("Saved StripePaymentModel (session):", created._id?.toString ? created._id.toString() : created._id);

              // Also create legacy eSewa-like PaymentModel entry if metadata contains required fields
              try {
                const paymentExists = await PaymentModel.findOne({
                  refId: meta.refId || orderId || session.id,
                });
                if (!paymentExists) {
                  const paymentDoc = {
                    fullName:
                      meta.fullName || meta.buyerName || buyerName || "",
                    phoneNo:
                      meta.phoneNo || meta.buyerPhone || buyerPhone || "",
                    email: resolvedEmail || session.customer_email || meta.email || "",
                    phoneModel: meta.phoneModel || "",
                    sellerId: meta.sellerId || "",
                    price:
                      Number(meta.price) ||
                      (session.amount_total ? Number(session.amount_total) / 100 : 0),
                    location: meta.location || "",
                    date: meta.date || new Date().toISOString().split("T")[0],
                    time: meta.time || new Date().toLocaleTimeString(),
                    oid: meta.oid || orderId || session.id,
                    refId: meta.refId || orderId || session.id,
                    amt:
                      String(meta.amt) ||
                      (session.amount_total ? String(session.amount_total) : "0"),
                    status: "Success",
                    raw: JSON.stringify(session),
                  };

                  await PaymentModel.create(paymentDoc as any);
                }
              } catch (pmErr: any) {
                paymentConsole.error("Failed to create PaymentModel record:", pmErr);
              }
            }
          } catch (dbErr: any) {
            paymentConsole.error("Failed to persist Stripe session:", dbErr);
          }
          break;
        }

        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          paymentConsole.log("PaymentIntent succeeded:", pi.id);
          try {
            const existing = await StripePaymentModel.findOne({ paymentIntentId: pi.id });
            const meta = pi.metadata || {};
            const productId = (meta.productId as string) || undefined;
            const orderId = (meta.orderId as string) || undefined;
            const buyerName = (meta.buyerName as string) || undefined;
            const buyerPhone = (meta.buyerPhone as string) || undefined;

            // attempt to fetch item snapshot
            let itemSnapshot = null;
            if (productId) {
              try {
                const item = await ItemModel.findById(productId).lean();
                if (item) {
                  itemSnapshot = item;
                  if (!existing) {
                    try {
                      await ItemModel.updateOne(
                        { _id: productId },
                        { $set: { isSold: true, status: "sold" } }
                      );
                      // Notify seller that their item was sold
                      const sellerId = (item as any).sellerId?.toString();
                      const productName = (item as any).phoneModel || "your item";
                      if (sellerId) {
                        await NotificationService.notifyProductSold(sellerId, productId, productName);
                      }
                    } catch (markErr: any) {
                      paymentConsole.error("Failed to mark item as sold:", markErr);
                    }
                  }
                }
              } catch (itmErr: any) {
                paymentConsole.error("Failed to load item for payment snapshot:", itmErr);
              }
            }

            // Use an idempotent upsert to avoid duplicate inserts and avoid
            // writing an explicit `sessionId: null` value which can conflict
            // with older unique/non-sparse indexes in the database.
            const resolvedEmail = await resolveEmail(pi);
            const upsertDoc: any = {
              paymentIntentId: pi.id,
              amount: pi.amount ? Number(pi.amount) / 100 : 0,
              currency: pi.currency || "usd",
              customerEmail: resolvedEmail || (pi.receipt_email as string) || "",
              metadata: meta,
              productId,
              orderId,
              buyerName,
              buyerPhone,
              itemSnapshot,
              status: "completed",
              raw: pi,
            };

            const created = await StripePaymentModel.findOneAndUpdate(
              { paymentIntentId: pi.id },
              { $set: upsertDoc },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            paymentConsole.log(
              existing ? "Updated existing StripePaymentModel (payment_intent):" : "Saved StripePaymentModel (payment_intent):",
              created?._id?.toString ? created._id.toString() : created?._id
            );

            // Also create legacy PaymentModel entry if needed
            if (!existing) {
              try {
                const paymentExists = await PaymentModel.findOne({
                  refId: meta.refId || orderId || pi.id,
                });
                if (!paymentExists) {
                  const paymentDoc = {
                    fullName: meta.fullName || meta.buyerName || buyerName || "",
                    phoneNo: meta.phoneNo || meta.buyerPhone || buyerPhone || "",
                    email: resolvedEmail || (meta.email as string) || "",
                    phoneModel: meta.phoneModel || "",
                    sellerId: meta.sellerId || "",
                    price: Number(meta.price) || (pi.amount ? Number(pi.amount) / 100 : 0),
                    location: meta.location || "",
                    date: meta.date || new Date().toISOString().split("T")[0],
                    time: meta.time || new Date().toLocaleTimeString(),
                    oid: meta.oid || orderId || pi.id,
                    refId: meta.refId || orderId || pi.id,
                    amt: String(meta.amt) || (pi.amount ? String(pi.amount) : "0"),
                    status: "Success",
                    raw: JSON.stringify(pi),
                  };

                  await PaymentModel.create(paymentDoc as any);
                }
              } catch (pmErr: any) {
                paymentConsole.error("Failed to create PaymentModel record:", pmErr);
              }
            }
          } catch (dbErr: any) {
            paymentConsole.error("Failed to persist PaymentIntent:", dbErr);
          }
          break;
        }

        default:
          paymentConsole.log(`Unhandled event type ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err: any) {
      paymentConsole.error("Error handling webhook event:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
}

export default new PaymentController();
