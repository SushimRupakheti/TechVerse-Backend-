import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import { ItemModel } from "../../models/item.model";
import bycryptjs from "bcryptjs";

describe("Normal user dashboard integration tests", () => {
  const ts = Date.now();

  const userA = {
    firstName: "UserA",
    lastName: "Tester",
    email: `usera${ts}@example.com`,
    contactNo: "9000000010",
    address: "addr A",
    password: "UserAPass1",
    role: "user",
  } as any;

  const userB = {
    firstName: "UserB",
    lastName: "Tester",
    email: `userb${ts}@example.com`,
    contactNo: "9000000011",
    address: "addr B",
    password: "UserBPass1",
    role: "user",
  } as any;

  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let itemId: string;

  const sampleItem = {
    photos: ["/uploads/img1.jpg"],
    category: "mobile",
    phoneModel: "iPhone X",
    itemName: "iPhone X",
    price: 250,
    finalPrice: 300,
    year: 2018,
    deviceCondition: "Good",
    description: "Good phone",
  };

  beforeAll(async () => {
    // cleanup any leftovers
    await UserModel.deleteOne({ email: userA.email });
    await UserModel.deleteOne({ email: userB.email });

    // create users directly (hash passwords) then login to obtain tokens
    const aHash = await bycryptjs.hash(userA.password, 10);
    const bHash = await bycryptjs.hash(userB.password, 10);
    const aDoc = (await UserModel.create({ ...userA, password: aHash })) as any;
    const bDoc = (await UserModel.create({ ...userB, password: bHash })) as any;
    userAId = aDoc._id.toString();

    const resA = await request(app).post("/api/auth/login").send({
      email: userA.email,
      password: userA.password,
    });
    tokenA = resA.body.token;

    const resB = await request(app).post("/api/auth/login").send({
      email: userB.email,
      password: userB.password,
    });
    tokenB = resB.body.token;
  });

  afterAll(async () => {
    if (itemId) {
      await ItemModel.deleteOne({ _id: itemId as any });
    }
    await UserModel.deleteOne({ email: userA.email });
    await UserModel.deleteOne({ email: userB.email });
  });

  test("1) registered user can login (sanity)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: userA.email,
      password: userA.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  test("2) GET /api/auth/:id returns user profile", async () => {
    const res = await request(app).get(`/api/auth/${userAId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("email", userA.email);
  });

  test("3) PUT /api/auth/update/:id updates profile", async () => {
    const res = await request(app)
      .put(`/api/auth/update/${userAId}`)
      .send({ firstName: "UpdatedA" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("firstName", "UpdatedA");
  });

  test("4) Creating item without token fails (401)", async () => {
    const res = await request(app).post("/api/items").send(sampleItem);
    expect(res.status).toBe(401);
  });

  test("5) Creating item with valid token succeeds", async () => {
    const res = await request(app)
      .post("/api/items")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sampleItem);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("item");
    itemId = (res.body.item as any)._id;
  });

  test("6) GET /api/items returns list including created item", async () => {
    const res = await request(app).get("/api/items");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    const found = (res.body.items as any[]).some((it) => it._id === itemId);
    expect(found).toBe(true);
  });

  test("7) GET /api/items/user/:userId returns user's items", async () => {
    const res = await request(app).get(`/api/items/user/${userAId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect((res.body.items as any[]).length).toBeGreaterThanOrEqual(1);
  });

  test("8) userB cannot update userA's item (403)", async () => {
    const res = await request(app)
      .put(`/api/items/${itemId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ phoneModel: "MaliciousUpdate" });
    expect(res.status).toBe(403);
  });

  test("9) owner can update their item", async () => {
    const res = await request(app)
      .put(`/api/items/${itemId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ phoneModel: "iPhone X - Edited" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("item");
    expect(res.body.item).toHaveProperty("phoneModel", "iPhone X - Edited");
  });

  test("10) getting item by id returns populated sellerId fields", async () => {
    const res = await request(app).get(`/api/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("item");
    // populated sellerId should have firstName
    expect(res.body.item.sellerId).toHaveProperty("firstName");
  });

  test("11) cleanup: remove created item via direct model delete", async () => {
    const del = await ItemModel.findByIdAndDelete(itemId as any);
    expect(del).not.toBeNull();
  });
});
