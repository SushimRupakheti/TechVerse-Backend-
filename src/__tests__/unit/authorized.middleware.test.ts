import jwt from "jsonwebtoken";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";
import { UserRepository } from "../../repositories/auth.repository";

describe("Authorization middleware unit tests", () => {
  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1) authorizedMiddleWare returns 401 when Authorization header missing", async () => {
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await authorizedMiddleWare(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "unauthorized ,No bearer token" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("2) authorizedMiddleWare returns 401 for invalid token format", async () => {
    const req: any = { headers: { authorization: "Bearer not-a-jwt" } };
    const res = makeRes();
    const next = jest.fn();

    await authorizedMiddleWare(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Unauthorized, Invalid Token Format" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("3) authorizedMiddleWare returns 401 when jwt.verify throws (TokenExpiredError)", async () => {
    const req: any = { headers: { authorization: "Bearer a.b.c" } };
    const res = makeRes();
    const next = jest.fn();

    const err: any = new Error("jwt expired");
    err.name = "TokenExpiredError";

    jest.spyOn(jwt, "verify").mockImplementation(() => {
      throw err;
    });

    await authorizedMiddleWare(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "jwt expired" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("4) authorizedMiddleWare returns 401 when decoded payload missing id", async () => {
    const req: any = { headers: { authorization: "Bearer a.b.c" } };
    const res = makeRes();
    const next = jest.fn();

    jest.spyOn(jwt, "verify").mockReturnValue({} as any);

    await authorizedMiddleWare(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Unauthorized, Invalid Token" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("5) authorizedMiddleWare returns 401 when user not found", async () => {
    const req: any = { headers: { authorization: "Bearer a.b.c" } };
    const res = makeRes();
    const next = jest.fn();

    jest.spyOn(jwt, "verify").mockReturnValue({ id: "user123" } as any);
    jest.spyOn(UserRepository.prototype, "getUserById").mockResolvedValue(null);

    await authorizedMiddleWare(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Unauthorized, User Not Found" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("6) authorizedMiddleWare supports quoted token and verifies cleaned JWT", async () => {
    const req: any = { headers: { authorization: 'Bearer "a.b.c"' } };
    const res = makeRes();
    const next = jest.fn();

    const verifySpy = jest.spyOn(jwt, "verify").mockReturnValue({ id: "user123" } as any);
    jest
      .spyOn(UserRepository.prototype, "getUserById")
      .mockResolvedValue({ _id: "user123", role: "user" } as any);

    await authorizedMiddleWare(req, res as any, next);

    expect(verifySpy).toHaveBeenCalledWith("a.b.c", expect.any(String));
    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("7) authorizedMiddleWare supports header like 'Bearer Bearer <jwt>'", async () => {
    const req: any = { headers: { authorization: "Bearer Bearer a.b.c" } };
    const res = makeRes();
    const next = jest.fn();

    const verifySpy = jest.spyOn(jwt, "verify").mockReturnValue({ id: "user123" } as any);
    jest
      .spyOn(UserRepository.prototype, "getUserById")
      .mockResolvedValue({ _id: "user123", role: "user" } as any);

    await authorizedMiddleWare(req, res as any, next);

    expect(verifySpy).toHaveBeenCalledWith("a.b.c", expect.any(String));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("8) adminMiddleware returns 401 when req.user missing", async () => {
    const req: any = {};
    const res = makeRes();
    const next = jest.fn();

    await adminMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Unauthorized, User Not Found" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("9) adminMiddleware returns 403 when user is not admin", async () => {
    const req: any = { user: { role: "user" } };
    const res = makeRes();
    const next = jest.fn();

    await adminMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Forbidden, Admins Only" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("10) adminMiddleware calls next when user is admin", async () => {
    const req: any = { user: { role: "admin" } };
    const res = makeRes();
    const next = jest.fn();

    await adminMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
