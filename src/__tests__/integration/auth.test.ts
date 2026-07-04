import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";

describe(
    "Authentication Integration Tests",  // name of test suite/group
    () => { // what to do in test
        const testUser =   {
        "firstName":"Test",
        "lastName":"User",
        "email":"testuser123@gmail.com",
        "contactNo":"9987654321",
        "address":"testAddress",
        "password":"password",
    }
        beforeAll(async () => {
            // Clean up test user if exists
            await UserModel.deleteOne({ email: testUser.email });
        });
        afterAll(async () => {
            // Clean up test user after tests
            await UserModel.deleteOne({ email: testUser.email });
        });

        describe(
            "POST /api/auth/register", // nested test suite/group
            () => {
                test(
                    "should register a new user", // name of individual test
                    async () => { // what to do in test
                        const response = await request(app)
                            .post("/api/auth/register")
                            .send(testUser)
                        
                        expect(response.status).toBe(201);
                        expect(response.body).toHaveProperty(
                            "message", 
                            "Registered Success"
                        );
                    }
                )
                test(
                    "should not register user with existing email",
                    async () => {
                        const response = await request(app)
                            .post("/api/auth/register")
                            .send(testUser)

                        // The service throws an HttpError which the controller
                        // currently catches and returns a 500 with the error message.
                        expect(response.status).toBe(500);
                        expect(response.body).toHaveProperty(
                            "message",
                            "email already registered"
                        );
                    }
                )

                describe("POST /api/auth/login", () => {
                    test("should login registered user", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: testUser.email, password: testUser.password });

                        expect(res.status).toBe(200);
                        expect(res.body).toHaveProperty("token");
                        expect(res.body).toHaveProperty("data");
                        expect(res.body.data).toHaveProperty("email", testUser.email);
                        expect(res.body.data).not.toHaveProperty("password");
                    });

                    test("should return 404 for invalid password", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: testUser.email, password: "wrongpass" });

                        expect(res.status).toBe(404);
                        expect(res.body).toHaveProperty("message", "Invalid password");
                    });

                    test("should return 404 for non-existent email", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: "noone_exists_123@example.com", password: "password" });

                        expect(res.status).toBe(404);
                        expect(res.body).toHaveProperty("message", "user not found");
                    });

                    test("should return 400 for invalid email format", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: "bad-email-format", password: "password" });

                        expect(res.status).toBe(400);
                        expect(res.body).toHaveProperty("message");
                        expect(res.body.success).toBe(false);
                    });

                    test("should return 400 when password is missing", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: testUser.email });

                        expect(res.status).toBe(400);
                        expect(res.body).toHaveProperty("message");
                        expect(res.body.success).toBe(false);
                    });

                    test("should return 400 when password is too short", async () => {
                        const res = await request(app)
                            .post("/api/auth/login")
                            .send({ email: testUser.email, password: "123" });

                        expect(res.status).toBe(400);
                        expect(res.body).toHaveProperty("message");
                        expect(res.body.success).toBe(false);
                    });
                });
            }
        )
    }
)