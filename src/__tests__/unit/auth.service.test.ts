import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

import { AuthService } from "../../services/auth.services";
import { UserRepository } from "../../repositories/auth.repository";
import { UserModel } from "../../models/user.model";
import * as email from "../../config/email";
import { HttpError } from "../../errors/http-error";

describe("AuthService unit tests", () => {
  const service = new AuthService();

  const baseUserInput = {
    firstName: "Test",
    lastName: "User",
    email: "unit.user@example.com",
    contactNo: "9000000000",
    address: "somewhere",
    password: "Password123",
    role: "user",
  } as any;

  const userId = new mongoose.Types.ObjectId();
  const repoUser = {
    _id: userId,
    email: baseUserInput.email,
    password: "hashed_password",
    role: "user",
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1) registerUser throws 409 if email already registered", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(repoUser);

    await expect(service.registerUser({ ...baseUserInput } as any)).rejects.toMatchObject({
      statusCode: 409,
      message: "email already registered",
    });
  });

  test("2) registerUser hashes password and creates user", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(null);

    const hashSpy = jest
      .spyOn(bcryptjs as any, "hash")
      .mockImplementation(async () => "hashed_pw");

    const createSpy = jest
      .spyOn(UserRepository.prototype, "createUser")
      .mockResolvedValue({ _id: userId, email: baseUserInput.email } as any);

    const input = { ...baseUserInput };
    const created = await service.registerUser(input as any);

    expect(hashSpy).toHaveBeenCalledWith(baseUserInput.password, 10);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email: baseUserInput.email, password: "hashed_pw" })
    );
    expect(created).toHaveProperty("email", baseUserInput.email);
  });

  test("3) LoginUser throws 404 if user not found", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(null);

    await expect(
      service.LoginUser({ email: "missing@example.com", password: "Password123" } as any)
    ).rejects.toMatchObject({ statusCode: 404, message: "user not found" });
  });

  test("4) LoginUser throws 404 if password is invalid", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(repoUser);

    jest
      .spyOn(bcryptjs as any, "compare")
      .mockImplementation(async () => false);

    await expect(
      service.LoginUser({ email: baseUserInput.email, password: "wrong" } as any)
    ).rejects.toMatchObject({ statusCode: 404, message: "Invalid password" });
  });

  test("5) LoginUser signs JWT and returns token on success", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(repoUser);

    jest
      .spyOn(bcryptjs as any, "compare")
      .mockImplementation(async () => true);

    const signSpy = jest
      .spyOn(jwt, "sign")
      .mockReturnValue("token_123" as any);

    const result = await service.LoginUser({
      email: baseUserInput.email,
      password: baseUserInput.password,
    } as any);

    expect(signSpy).toHaveBeenCalled();
    expect(result).toHaveProperty("token", "token_123");
    expect(result).toHaveProperty("user", repoUser);
  });

  test("6) updateUser hashes password if provided", async () => {
    const hashSpy = jest
      .spyOn(bcryptjs as any, "hash")
      .mockImplementation(async () => "new_hashed");

    const updateSpy = jest
      .spyOn(UserRepository.prototype, "updateUserById")
      .mockResolvedValue({ _id: userId, firstName: "Updated" } as any);

    await service.updateUser(userId.toString(), { password: "NewPass123" } as any);

    expect(hashSpy).toHaveBeenCalledWith("NewPass123", 10);
    expect(updateSpy).toHaveBeenCalledWith(
      userId.toString(),
      expect.objectContaining({ password: "new_hashed" })
    );
  });

  test("7) updateUser throws 404 if user does not exist", async () => {
    jest
      .spyOn(UserRepository.prototype, "updateUserById")
      .mockResolvedValue(null);

    await expect(
      service.updateUser(userId.toString(), { firstName: "Nope" } as any)
    ).rejects.toMatchObject({ statusCode: 404, message: "User not found" });
  });

  test("8) sendResetPasswordEmail throws 400 when email is missing", async () => {
    await expect(service.sendResetPasswordEmail(undefined)).rejects.toBeInstanceOf(HttpError);
    await expect(service.sendResetPasswordEmail(undefined)).rejects.toMatchObject({
      statusCode: 400,
      message: "Email is required",
    });
  });

  test("9) sendResetPasswordEmail sends reset email with token link", async () => {
    jest
      .spyOn(UserRepository.prototype, "getUserByEmail")
      .mockResolvedValue(repoUser);

    jest.spyOn(jwt, "sign").mockReturnValue("reset_token" as any);

    const sendSpy = jest.spyOn(email, "sendEmail").mockResolvedValue(undefined as any);

    const res = await service.sendResetPasswordEmail(baseUserInput.email);

    expect(sendSpy).toHaveBeenCalledWith(
      baseUserInput.email,
      "Password Reset",
      expect.stringContaining("reset-password?token=reset_token")
    );
    expect(res).toBe(repoUser);
  });

  test("10) resetPassword verifies token and updates password", async () => {
    jest
      .spyOn(jwt, "verify")
      .mockReturnValue({ id: userId.toString() } as any);

    jest
      .spyOn(UserRepository.prototype, "getUserById")
      .mockResolvedValue(repoUser);

    jest
      .spyOn(bcryptjs as any, "hash")
      .mockImplementation(async () => "hashed_new_pw");

    const updateSpy = jest
      .spyOn(UserRepository.prototype, "updateUserById")
      .mockResolvedValue(repoUser);

    const res = await service.resetPassword("valid_token", "NewPassword123");

    expect(updateSpy).toHaveBeenCalledWith(userId.toString(), {
      password: "hashed_new_pw",
    });
    expect(res).toBe(repoUser);
  });

  test("11) resetPassword throws 400 when token is invalid/expired", async () => {
    const err: any = new Error("bad token");
    err.name = "JsonWebTokenError";
    jest.spyOn(jwt, "verify").mockImplementation(() => {
      throw err;
    });

    await expect(service.resetPassword("bad_token", "NewPassword123")).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid or expired token",
    });
  });

  test("12) updateProfileImage throws when user is not found", async () => {
    jest
      .spyOn(UserModel, "findByIdAndUpdate")
      .mockResolvedValue(null as any);

    await expect(service.updateProfileImage(userId.toString(), "/uploads/x.png")).rejects.toMatchObject({
      message: "User not found",
    });
  });

  test("13) updateProfileImage returns updated user", async () => {
    const updated = { _id: userId, profileImage: "/uploads/x.png" } as any;
    jest
      .spyOn(UserModel, "findByIdAndUpdate")
      .mockResolvedValue(updated as any);

    const res = await service.updateProfileImage(userId.toString(), "/uploads/x.png");
    expect(res).toBe(updated);
  });
});
