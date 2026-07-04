import request from "supertest";
import app from "../../app";
import mongoose from "mongoose";
import bycryptjs from "bcryptjs";
import { UserModel } from "../../models/user.model";
import { NotificationModel } from "../../models/notification.model";

describe("Notification routes integration tests", () => {
  const ts = Date.now();

  const userA = {
    firstName: "Notify",
    lastName: "UserA",
    email: `notify.usera.${ts}@example.com`,
    contactNo: "9000000101",
    address: "addr A",
    password: "UserAPass123",
    role: "user",
  } as any;

  const userB = {
    firstName: "Notify",
    lastName: "UserB",
    email: `notify.userb.${ts}@example.com`,
    contactNo: "9000000102",
    address: "addr B",
    password: "UserBPass123",
    role: "user",
  } as any;

  let tokenA = "";
  let tokenB = "";
  let userAId = "";
  let userBId = "";

  let notifA1Id = "";
  let notifA2Id = "";
  let notifA3Id = "";
  let notifB1Id = "";

  beforeAll(async () => {
    await UserModel.deleteOne({ email: userA.email });
    await UserModel.deleteOne({ email: userB.email });

    const aHash = await bycryptjs.hash(userA.password, 10);
    const bHash = await bycryptjs.hash(userB.password, 10);

    const aDoc: any = await UserModel.create({ ...userA, password: aHash });
    const bDoc: any = await UserModel.create({ ...userB, password: bHash });

    userAId = aDoc._id.toString();
    userBId = bDoc._id.toString();

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

    await NotificationModel.deleteMany({ user: { $in: [userAId, userBId] } });

    const createdA: any = await NotificationModel.create([
      {
        user: userAId,
        title: "Welcome A1",
        message: "Test notification A1",
        type: "ADMIN_CUSTOM",
        item: null,
        isRead: false,
      },
      {
        user: userAId,
        title: "Welcome A2",
        message: "Test notification A2",
        type: "ADMIN_CUSTOM",
        item: null,
        isRead: false,
      },
      {
        user: userAId,
        title: "Welcome A3",
        message: "Test notification A3",
        type: "ADMIN_CUSTOM",
        item: null,
        isRead: false,
      },
    ]);

    notifA1Id = createdA[0]._id.toString();
    notifA2Id = createdA[1]._id.toString();
    notifA3Id = createdA[2]._id.toString();

    const createdB: any = await NotificationModel.create({
      user: userBId,
      title: "Welcome B1",
      message: "Test notification B1",
      type: "ADMIN_CUSTOM",
      item: null,
      isRead: false,
    });

    notifB1Id = createdB._id.toString();
  });

  afterAll(async () => {
    if (userAId || userBId) {
      await NotificationModel.deleteMany({ user: { $in: [userAId, userBId] } });
    }
    await UserModel.deleteOne({ email: userA.email });
    await UserModel.deleteOne({ email: userB.email });
  });

  test("1) GET /api/notifications without token returns 401", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("success", false);
  });

  test("2) GET /api/notifications returns only authenticated user's notifications", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const titles = (res.body.data as any[]).map((n) => n.title);
    expect(titles).toContain("Welcome A1");
    expect(titles).toContain("Welcome A2");
    expect(titles).toContain("Welcome A3");
    expect(titles).not.toContain("Welcome B1");
  });

  test("3) GET /api/notifications returns newest first (createdAt desc)", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const notifications = res.body.data as any[];

    const times = notifications.map((n) => new Date(n.createdAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  test("4) PUT /api/notifications/:id/read marks a notification as read", async () => {
    const res = await request(app)
      .put(`/api/notifications/${notifA1Id}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Notification marked as read");
    expect(res.body.data).toHaveProperty("isRead", true);

    const dbDoc = await NotificationModel.findById(notifA1Id).lean();
    expect(dbDoc?.isRead).toBe(true);
  });

  test("5) PUT /api/notifications/:id/read with invalid id returns 400", async () => {
    const res = await request(app)
      .put("/api/notifications/not-a-valid-id/read")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("message", "Invalid notification ID");
  });

  test("6) PUT /api/notifications/:id/read with non-existent id returns 404", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .put(`/api/notifications/${missingId}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("message", "Notification not found");
  });

  test("7) PUT /api/notifications/:id/read cannot mark someone else's notification (403)", async () => {
    const res = await request(app)
      .put(`/api/notifications/${notifB1Id}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty(
      "message",
      "You can only update your own notifications"
    );
  });

  test("8) DELETE /api/notifications/:id deletes own notification", async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifA2Id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Notification deleted");

    const dbDoc = await NotificationModel.findById(notifA2Id).lean();
    expect(dbDoc).toBeNull();
  });

  test("9) DELETE /api/notifications/:id with invalid id returns 400", async () => {
    const res = await request(app)
      .delete("/api/notifications/bad-id")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("message", "Invalid notification ID");
  });

  test("10) DELETE /api/notifications/:id cannot delete someone else's notification (403)", async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifB1Id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty(
      "message",
      "You can only delete your own notifications"
    );

    // sanity: other user's notification should still exist
    const stillThere = await NotificationModel.findById(notifB1Id).lean();
    expect(stillThere).not.toBeNull();
  });
});
