import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import bycryptjs from "bcryptjs";

describe("Admin routes integration tests", () => {
  const ts = Date.now();
  const admin = {
    firstName: "Sys",
    lastName: "Admin",
    email: `sysadmin${ts}@example.com`,
    contactNo: "9000000001",
    address: "hq",
    password: "AdminPass123",
    role: "admin",
  } as any;

  const user = {
    firstName: "Normal",
    lastName: "Tester",
    email: `normuser${ts}@example.com`,
    contactNo: "9000000002",
    address: "home",
    password: "UserPass123",
    role: "user",
  } as any;

  let adminToken: string;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    await UserModel.deleteOne({ email: admin.email });
    await UserModel.deleteOne({ email: user.email });

    const aHash = await bycryptjs.hash(admin.password, 10);
    const uHash = await bycryptjs.hash(user.password, 10);

    const a = (await UserModel.create({ ...admin, password: aHash })) as any;
    const u = (await UserModel.create({ ...user, password: uHash })) as any;
    const uDoc = Array.isArray(u) ? u[0] : u;
    userId = uDoc._id.toString();

    const aRes = await request(app).post("/api/auth/login").send({
      email: admin.email,
      password: admin.password,
    });
    adminToken = aRes.body.token;

    const uRes = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: user.password,
    });
    userToken = uRes.body.token;
  });

  afterAll(async () => {
    await UserModel.deleteOne({ email: admin.email });
    await UserModel.deleteOne({ email: user.email });
  });

  test("GET /api/admin/users without token returns 401", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("GET /api/admin/users with non-admin token returns 403", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("message", "Forbidden, Admins Only");
  });

  test("GET /api/admin/users with admin token returns paginated list", async () => {
    const res = await request(app)
      .get("/api/admin/users?page=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty("perPage", 10);
  });

  test("GET /api/admin/users/:userid returns the user for admin", async () => {
    const res = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("email", user.email);
  });

  test("PUT /api/admin/users/:userid updates user (admin)", async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "UpdatedName" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("firstName", "UpdatedName");
  });

  test("DELETE /api/admin/users/:userid deletes user (admin)", async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "User deleted successfully");

    // subsequent fetch should return 404
    const again = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(again.status).toBe(404);
  });
});
