import request from "supertest";
import mongoose from "mongoose";
import bycryptjs from "bcryptjs";
import { UserModel } from "../../models/user.model";
import { ItemModel } from "../../models/item.model";
import { StripePaymentModel } from "../../models/stripePayment.model";
import { PaymentModel } from "../../models/payment.model";
import { NotificationModel } from "../../models/notification.model";

const mockCheckoutSessionsCreate = jest.fn();
const mockPaymentIntentsCreate = jest.fn();

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        checkout: { sessions: { create: mockCheckoutSessionsCreate } },
        paymentIntents: { create: mockPaymentIntentsCreate },
        webhooks: { constructEvent: jest.fn() },
        customers: { retrieve: jest.fn() },
      };
    }),
  };
});

describe("Payment routes integration tests", () => {
  const ts = Date.now();

  const admin = {
    firstName: "Pay",
    lastName: "Admin",
    email: `pay.admin.${ts}@example.com`,
    contactNo: "9000000201",
    address: "hq",
    password: "AdminPass123",
    role: "admin",
  } as any;

  const normalUser = {
    firstName: "Pay",
    lastName: "User",
    email: `pay.user.${ts}@example.com`,
    contactNo: "9000000202",
    address: "home",
    password: "UserPass123",
    role: "user",
  } as any;

  const seller = {
    firstName: "Pay",
    lastName: "Seller",
    email: `pay.seller.${ts}@example.com`,
    contactNo: "9000000203",
    address: "seller-addr",
    password: "SellerPass123",
    role: "user",
  } as any;

  const webhookSessionId = `cs_test_${ts}`;
  const webhookPaymentIntentId = `pi_test_${ts}`;
  const webhookRefId = `test-ref-${ts}`;
  const webhookOrderId = `test-order-${ts}`;

  const originalEnv: Record<string, string | undefined> = {};

  let app: any;
  let adminToken = "";
  let userToken = "";

  let sellerId = "";
  let itemId = "";

  const sampleItem = {
    photos: ["/uploads/img1.jpg"],
    category: "mobile",
    phoneModel: "Pixel Test",
    itemName: "Pixel Test",
    price: 250,
    finalPrice: 300,
    year: 2020,
    deviceCondition: "Good",
    description: "Payment test item",
  };

  beforeAll(async () => {
    // Force predictable Stripe behavior for tests (no network calls)
    originalEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    originalEnv.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
    originalEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    originalEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    originalEnv.PAYMENT_SILENT = process.env.PAYMENT_SILENT;

    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
    // payment.controller.ts prefers NEXT_PUBLIC_* first; set it so dotenv can't
    // re-inject a real key from .env during tests.
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
    // Empty webhook secret enables the controller's TEST MODE (no signature verification)
    // and prevents dotenv from overriding it.
    process.env.STRIPE_WEBHOOK_SECRET = "";
    process.env.PAYMENT_SILENT = "true";

    mockCheckoutSessionsCreate.mockImplementation(async (payload: any) => {
      return {
        id: `cs_mock_${ts}_${mockCheckoutSessionsCreate.mock.calls.length}`,
        url: "https://example.com/checkout",
        customer_email: payload?.customer_email,
        metadata: payload?.metadata,
      };
    });

    mockPaymentIntentsCreate.mockImplementation(async (payload: any) => {
      return {
        id: `pi_mock_${ts}_${mockPaymentIntentsCreate.mock.calls.length}`,
        client_secret: `pi_secret_${ts}_${mockPaymentIntentsCreate.mock.calls.length}`,
        currency: payload?.currency || "npr",
        receipt_email: payload?.receipt_email,
        metadata: payload?.metadata,
        amount: payload?.amount,
      };
    });

    // Import app AFTER env + mocks are set
    app = require("../../app").default;

    // Clean up any previous runs (defensive)
    await UserModel.deleteOne({ email: admin.email });
    await UserModel.deleteOne({ email: normalUser.email });
    await UserModel.deleteOne({ email: seller.email });

    const aHash = await bycryptjs.hash(admin.password, 10);
    const uHash = await bycryptjs.hash(normalUser.password, 10);
    const sHash = await bycryptjs.hash(seller.password, 10);

    const aDoc: any = await UserModel.create({ ...admin, password: aHash });
    const uDoc: any = await UserModel.create({ ...normalUser, password: uHash });
    const sDoc: any = await UserModel.create({ ...seller, password: sHash });

    sellerId = sDoc._id.toString();

    const aRes = await request(app).post("/api/auth/login").send({
      email: admin.email,
      password: admin.password,
    });
    adminToken = aRes.body.token;

    const uRes = await request(app).post("/api/auth/login").send({
      email: normalUser.email,
      password: normalUser.password,
    });
    userToken = uRes.body.token;

    const item: any = await ItemModel.create({
      ...sampleItem,
      // ItemType defines sellerId as string; schema will cast to ObjectId.
      sellerId,
    });

    itemId = item._id.toString();

    await StripePaymentModel.deleteMany({ sessionId: webhookSessionId });
    await StripePaymentModel.deleteMany({ paymentIntentId: webhookPaymentIntentId });
    await PaymentModel.deleteMany({ refId: webhookRefId });
    await NotificationModel.deleteMany({ user: sellerId, type: "SOLD", item: itemId });
  });

  afterAll(async () => {
    await StripePaymentModel.deleteMany({ sessionId: webhookSessionId });
    await StripePaymentModel.deleteMany({ paymentIntentId: webhookPaymentIntentId });
    await PaymentModel.deleteMany({ refId: webhookRefId });
    if (itemId) await ItemModel.findByIdAndDelete(itemId as any);
    await NotificationModel.deleteMany({ user: sellerId, type: "SOLD", item: itemId });

    await UserModel.deleteOne({ email: admin.email });
    await UserModel.deleteOne({ email: normalUser.email });
    await UserModel.deleteOne({ email: seller.email });

    const restoreEnvVar = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete (process.env as any)[key];
      } else {
        process.env[key] = value;
      }
    };

    restoreEnvVar("STRIPE_SECRET_KEY", originalEnv.STRIPE_SECRET_KEY);
    restoreEnvVar("STRIPE_PUBLISHABLE_KEY", originalEnv.STRIPE_PUBLISHABLE_KEY);
    restoreEnvVar(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      originalEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    );
    restoreEnvVar("STRIPE_WEBHOOK_SECRET", originalEnv.STRIPE_WEBHOOK_SECRET);
    restoreEnvVar("PAYMENT_SILENT", originalEnv.PAYMENT_SILENT);
  });

  beforeEach(() => {
    mockCheckoutSessionsCreate.mockClear();
    mockPaymentIntentsCreate.mockClear();
  });

  test("1) POST /api/payments/stripe/checkout returns 400 for invalid amount", async () => {
    const res = await request(app)
      .post("/api/payments/stripe/checkout")
      .send({ amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid amount");
  });

  test("2) POST /api/payments/stripe/checkout returns sessionId + url", async () => {
    const res = await request(app)
      .post("/api/payments/stripe/checkout")
      .send({
        amount: 300,
        productName: "Test Product",
        productId: itemId,
        orderId: `order_${ts}`,
        buyerEmail: "buyer@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessionId");
    expect(res.body).toHaveProperty("url");
    expect(typeof res.body.sessionId).toBe("string");
    expect(typeof res.body.url).toBe("string");
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const payload = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(payload.line_items[0].price_data.currency).toBe("npr");
  });

  test("3) checkout session includes customer_email and metadata.email", async () => {
    await request(app).post("/api/payments/stripe/checkout").send({
      amount: 300,
      productId: itemId,
      orderId: `order_meta_${ts}`,
      buyerEmail: "meta@example.com",
      metadata: { foo: "bar" },
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const payload = mockCheckoutSessionsCreate.mock.calls[0][0];

    expect(payload).toHaveProperty("customer_email", "meta@example.com");
    expect(payload).toHaveProperty("metadata");
    expect(payload.metadata).toHaveProperty("foo", "bar");
    expect(payload.metadata).toHaveProperty("email", "meta@example.com");
  });

  test("4) payment_intent flow returns clientSecret + publishableKey", async () => {
    const res = await request(app)
      .post("/api/payments/stripe/checkout")
      .send({
        flow: "payment_intent",
        amount: 300,
        productId: itemId,
        buyerEmail: "pi@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("clientSecret");
    expect(res.body).toHaveProperty("publishableKey", "pk_test_dummy");
    expect(res.body).toHaveProperty("currency", "npr");
    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
  });

  test("5) payment_intent includes receipt_email and metadata.email", async () => {
    await request(app).post("/api/payments/stripe/checkout").send({
      flow: "payment_intent",
      amount: 300,
      productId: itemId,
      buyerEmail: "receipt@example.com",
      metadata: { a: "b" },
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
    const payload = mockPaymentIntentsCreate.mock.calls[0][0];

    expect(payload).toHaveProperty("receipt_email", "receipt@example.com");
    expect(payload).toHaveProperty("currency", "npr");
    expect(payload).toHaveProperty("metadata");
    expect(payload.metadata).toHaveProperty("a", "b");
    expect(payload.metadata).toHaveProperty("email", "receipt@example.com");
  });

  test("6) GET /api/admin/payments without token returns 401", async () => {
    const res = await request(app).get("/api/admin/payments");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("success", false);
  });

  test("7) GET /api/admin/payments with non-admin token returns 403", async () => {
    const res = await request(app)
      .get("/api/admin/payments")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("message", "Forbidden, Admins Only");
  });

  test("8) Stripe webhook (checkout.session.completed) persists payment and marks item sold", async () => {
    const event: any = {
      id: `evt_${ts}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: webhookSessionId,
          object: "checkout.session",
          amount_total: 2000,
          currency: "npr",
          customer_email: "buyer-webhook@example.com",
          payment_intent: webhookPaymentIntentId,
          metadata: {
            productId: itemId,
            orderId: webhookOrderId,
            buyerName: "Webhook Buyer",
            buyerPhone: "9000009999",
            fullName: "Webhook Buyer",
            phoneNo: "9000009999",
            phoneModel: "Pixel Test",
            sellerId,
            price: 20,
            location: "test-loc",
            date: "2026-03-05",
            time: "10:00",
            oid: webhookOrderId,
            refId: webhookRefId,
            email: "buyer-webhook@example.com",
          },
        },
      },
    };

    const res = await request(app)
      .post("/api/payments/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(event);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("received", true);

    const stripeDoc = await StripePaymentModel.findOne({
      sessionId: webhookSessionId,
    }).lean();
    expect(stripeDoc).not.toBeNull();
    expect(stripeDoc?.currency).toBe("npr");

    const legacyDoc = await PaymentModel.findOne({ refId: webhookRefId }).lean();
    expect(legacyDoc).not.toBeNull();

    const updatedItem: any = await ItemModel.findById(itemId).lean();
    expect(updatedItem?.isSold).toBe(true);
    expect(updatedItem?.status).toBe("sold");

    const soldNotif = await NotificationModel.findOne({
      user: sellerId,
      type: "SOLD",
      item: itemId,
    }).lean();
    expect(soldNotif).not.toBeNull();
  });

  test("9) Stripe webhook is idempotent (no duplicate records)", async () => {
    const event: any = {
      id: `evt_${ts}_again`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: webhookSessionId,
          object: "checkout.session",
          amount_total: 2000,
          currency: "npr",
          customer_email: "buyer-webhook@example.com",
          payment_intent: webhookPaymentIntentId,
          metadata: {
            productId: itemId,
            orderId: webhookOrderId,
            buyerName: "Webhook Buyer",
            buyerPhone: "9000009999",
            fullName: "Webhook Buyer",
            phoneNo: "9000009999",
            phoneModel: "Pixel Test",
            sellerId,
            price: 20,
            location: "test-loc",
            date: "2026-03-05",
            time: "10:00",
            oid: webhookOrderId,
            refId: webhookRefId,
            email: "buyer-webhook@example.com",
          },
        },
      },
    };

    const res = await request(app)
      .post("/api/payments/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(event);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("received", true);

    const stripeCount = await StripePaymentModel.countDocuments({
      sessionId: webhookSessionId,
    });
    expect(stripeCount).toBe(1);

    const legacyCount = await PaymentModel.countDocuments({ refId: webhookRefId });
    expect(legacyCount).toBe(1);

    const notifCount = await NotificationModel.countDocuments({
      user: sellerId,
      type: "SOLD",
      item: itemId,
    });
    expect(notifCount).toBe(1);
  });

  test("10) GET /api/admin/payments/:id returns a payment for admin", async () => {
    const stripeDoc: any = await StripePaymentModel.findOne({
      sessionId: webhookSessionId,
    }).lean();

    expect(stripeDoc).not.toBeNull();

    const res = await request(app)
      .get(`/api/admin/payments/${stripeDoc._id.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("source", "stripe");
    expect(res.body.data).toHaveProperty("sessionId", webhookSessionId);
  });
});
