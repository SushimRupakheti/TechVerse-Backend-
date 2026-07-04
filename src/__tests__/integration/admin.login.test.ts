import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import bycryptjs from "bcryptjs";

describe("Admin Login Integration Tests", () => {
  const ts = Date.now();
  const adminUser = {
    firstName: "Admin",
    lastName: "Tester",
    email: `admintest${ts}@example.com`,
    contactNo: "9000000000",
    address: "admin addr",
    password: "AdminPass123",
    role: "admin",
  } as any;

  const normalUser = {
    firstName: "Normal",
    lastName: "User",
    email: `normal${ts}@example.com`,
    contactNo: "9111111111",
    address: "user addr",
    password: "UserPass123",
    role: "user",
  } as any;

  beforeAll(async () => {
    await UserModel.deleteOne({ email: adminUser.email });
    await UserModel.deleteOne({ email: normalUser.email });
    // insert hashed passwords
    const aHash = await bycryptjs.hash(adminUser.password, 10);
    const nHash = await bycryptjs.hash(normalUser.password, 10);
    await UserModel.create({ ...adminUser, password: aHash });
    await UserModel.create({ ...normalUser, password: nHash });
  });

  afterAll(async () => {
    await UserModel.deleteOne({ email: adminUser.email });
    await UserModel.deleteOne({ email: normalUser.email });
  });

  test("admin user can login and receives admin role in payload", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: adminUser.email, password: adminUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("email", adminUser.email);
    // role may be present on token payload; service returns user object
    expect(res.body.data).toHaveProperty("role", "admin");
  });

  test("normal user can login but is not admin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: normalUser.email, password: normalUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.data).toHaveProperty("role", "user");
  });

  test("invalid password for admin returns 404", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: adminUser.email, password: "badpass" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message", "Invalid password");
  });
});
