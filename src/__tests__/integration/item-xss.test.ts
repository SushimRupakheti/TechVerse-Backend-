import request from "supertest";
import bycryptjs from "bcryptjs";
import app from "../../app";
import { ItemModel } from "../../models/item.model";
import { UserModel } from "../../models/user.model";

describe("Item XSS protection", () => {
  const ts = Date.now();
  const user = {
    firstName: "Xss",
    lastName: "Seller",
    email: `xss.seller.${ts}@example.com`,
    contactNo: "9000000099",
    address: "ktm",
    password: "SellerPass123",
    role: "user",
  } as any;

  let token = "";
  let itemId = "";

  beforeAll(async () => {
    await UserModel.deleteOne({ email: user.email });
    const hash = await bycryptjs.hash(user.password, 10);
    await UserModel.create({ ...user, password: hash });

    const login = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: user.password,
    });
    token = login.body.token;
  });

  afterAll(async () => {
    if (itemId) await ItemModel.findByIdAndDelete(itemId as any);
    await UserModel.deleteOne({ email: user.email });
  });

  test("sets security headers with Helmet", async () => {
    const res = await request(app).get("/api/test");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });

  test("accepts valid products", async () => {
    const res = await request(app)
      .post("/api/items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        photos: ["/api/uploads/images/11111111-1111-4111-8111-111111111111.jpg"],
        category: "Mobile",
        phoneModel: "iPhone 14",
        itemName: "iPhone 14 Pro",
        location: "Kathmandu",
        year: 2022,
        deviceCondition: "Good",
        description: "Clean phone with box",
        price: 700,
        finalPrice: 750,
      });

    expect(res.status).toBe(201);
    expect(res.body.item).toHaveProperty("itemName", "iPhone 14 Pro");
    itemId = res.body.item._id;
  });

  test("sanitizes malicious create payload before MongoDB storage", async () => {
    if (itemId) await ItemModel.findByIdAndDelete(itemId as any);

    const res = await request(app)
      .post("/api/items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        photos: ["/api/uploads/images/22222222-2222-4222-8222-222222222222.jpg"],
        category: "Mobile <iframe src='x'></iframe>",
        phoneModel: "<script>alert(1)</script>iPhone",
        itemName: "<svg onload=alert(1)></svg>iPhone 15",
        location: "javascript:alert(1) Kathmandu",
        year: 2023,
        deviceCondition: "Good <object data='x'></object>",
        description: "Nice <img src=x onerror=alert(1)> phone data:text/html,test vbscript:msgbox(1)",
        price: 800,
        finalPrice: 850,
      });

    expect(res.status).toBe(201);
    itemId = res.body.item._id;

    const stored = await ItemModel.findById(itemId).lean();
    expect(stored?.phoneModel).toBe("iPhone");
    expect(stored?.itemName).toBe("iPhone 15");
    expect(stored?.category).toBe("Mobile");
    expect(stored?.location).not.toContain("javascript:");
    expect(stored?.description).not.toContain("<img");
    expect(stored?.description).not.toContain("onerror");
    expect(stored?.description).not.toContain("data:");
    expect(stored?.description).not.toContain("vbscript:");
  });

  test("sanitizes update payload and preserves CRUD response format", async () => {
    const res = await request(app)
      .put(`/api/items/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemName: "<img src=x onerror=alert(1)>Pixel 9",
        description: "Updated <script>alert(1)</script>safe description",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("item");

    const stored = await ItemModel.findById(itemId).lean();
    expect(stored?.itemName).toBe("Pixel 9");
    expect(stored?.description).toBe("Updated safe description");
    expect(JSON.stringify(stored)).not.toMatch(/<script|onerror|<svg|javascript:/i);
  });
});