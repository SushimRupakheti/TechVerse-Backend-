import { AuthService } from "../services/auth.services";
import { DisableTwoFactorDto, LoginUserDto, PublicRegisterUserDto, ResendVerificationDto, ResetPasswordDto, UpdateProfileDto, VerifyTwoFactorLoginDto, VerifyTwoFactorSetupDto } from "../dtos/auth.dto";
import z from "zod";
import { CookieOptions, Request, Response } from "express";
import { FRONTEND_URL, NODE_ENV } from "../config";
import { IUser } from "../models/user.model";
import { clearFailedLogins, recordFailedLogin } from "../middlewares/failed-login.middleware";



let authservice = new AuthService();

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: NODE_ENV === "production" ? "none" : "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function removeSensitiveUserFields(user: any) {
  const userObject = typeof user?.toObject === "function" ? user.toObject() : user;
  const { password, twoFactorSecret, ...userWithoutSensitiveFields } = userObject;
  return userWithoutSensitiveFields;
}

export class AuthController {
  async googleCallback(req: Request, res: Response) {
    try {
      const user = req.user as IUser | undefined;

      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?oauth=failed`);
      }

      const token = authservice.generateLoginToken(user);
      res.cookie("token", token, authCookieOptions);

      return res.redirect(`${FRONTEND_URL}/auth/success`);
    } catch (error) {
      return res.redirect(`${FRONTEND_URL}/login?oauth=failed`);
    }
  }

  async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    return res.status(200).json({
      success: true,
      data: removeSensitiveUserFields(req.user),
    });
  }

  async registerUser(req: Request, res: Response) {
    try {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, "role")) {
        return res.status(400).json({
          success: false,
          message: "Role cannot be set during public signup.",
        });
      }

      const parsedData = PublicRegisterUserDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json(
          { success: false, message: z.prettifyError(parsedData.error) }
        )
      }

      const newUser = await authservice.registerUser(parsedData.data);
      return res.status(201).json(
        { success: true, data: removeSensitiveUserFields(newUser), message: "Registration successful. A verification email has been sent." }
      )
    } catch (error: Error | any) {
      return res.status(error.statusCode || 500).json(
        { success: false, message: error.message || "Internal Server Error" }
      )
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : undefined;
      const result = await authservice.verifyEmail(token);
      return res.status(200).json({
        success: true,
        message: result.alreadyVerified
          ? "Email address is already verified."
          : "Email verified successfully.",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const parsedData = ResendVerificationDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsedData.error),
        });
      }

      const result = await authservice.resendVerification(parsedData.data.email);
      return res.status(200).json({
        success: true,
        message: result.alreadyVerified
          ? "Email address is already verified."
          : "If an unverified account exists for that email, a verification email has been sent.",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async loginUser(req: Request, res: Response) {
    try {
      const parsedData = LoginUserDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.formatError(parsedData.error),
        });
      }

      const result = await authservice.LoginUser(parsedData.data);

      clearFailedLogins(req);

      if ("twoFactorRequired" in result && result.twoFactorRequired) {
        return res.status(200).json({
          success: true,
          twoFactorRequired: true,
          userId: result.userId,
          email: result.email,
          message: "Two-factor authentication required",
        });
      }

      const { token, user } = result;
      const userWithoutPassword = removeSensitiveUserFields(user);
      res.cookie("token", token, authCookieOptions);
      return res.status(200).json({
        success: true,
        data: userWithoutPassword,
        token,
        message: "Login success",
      });
    } catch (error: any) {
      if (
        error?.message === "user not found" ||
        error?.message === "Invalid password" ||
        error?.message === "Please sign in with Google for this account"
      ) {
        recordFailedLogin(req);
      }
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async enableTwoFactor(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const result = await authservice.enableTwoFactor((req.user as any)._id.toString());

      return res.status(200).json({
        success: true,
        data: result,
        message: "Scan the QR code and verify OTP to enable 2FA",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async verifyTwoFactorSetup(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const parsedData = VerifyTwoFactorSetupDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.formatError(parsedData.error),
        });
      }

      const user = await authservice.verifyTwoFactorSetup(
        (req.user as any)._id.toString(),
        parsedData.data.otp
      );

      return res.status(200).json({
        success: true,
        data: removeSensitiveUserFields(user),
        message: "Two-factor authentication enabled successfully",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async verifyTwoFactorLogin(req: Request, res: Response) {
    try {
      const parsedData = VerifyTwoFactorLoginDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.formatError(parsedData.error),
        });
      }

      const { token, user } = await authservice.verifyTwoFactorLogin(parsedData.data);
      res.cookie("token", token, authCookieOptions);

      return res.status(200).json({
        success: true,
        data: removeSensitiveUserFields(user),
        token,
        message: "Login success",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async disableTwoFactor(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const parsedData = DisableTwoFactorDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.formatError(parsedData.error),
        });
      }

      const user = await authservice.disableTwoFactor(
        (req.user as any)._id.toString(),
        parsedData.data.password
      );

      return res.status(200).json({
        success: true,
        data: removeSensitiveUserFields(user),
        message: "Two-factor authentication disabled successfully",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async logoutUser(req: Request, res: Response) {
    try {
      // Allow logout without a token: call logout unconditionally
      await authservice.logout();

      // Clear cookie if present (no-op if cookies not configured)
      try { res.clearCookie("token", authCookieOptions); } catch (e) {}

      return res.status(200).json({ success: true, message: "Logout successful" });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }


  async updateUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const currentUser = req.user as any;
      const currentUserId = currentUser?._id?.toString();
      const currentUserRole = currentUser?.role;

      if (!currentUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (currentUserId !== userId && currentUserRole !== "admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const parsedData = UpdateProfileDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          success: false,
          message: z.prettifyError(parsedData.error),
        });
      }

      const updatedUser = await authservice.updateUser(userId, parsedData.data);
      return res.status(200).json({
        success: true,
        data: updatedUser,
        message: "User updated successfully",
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const user = await authservice.getUserById(userId);
      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }


  async sendResetPasswordEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const result = await authservice.sendResetPasswordEmail(email);

      return res.status(200).json({
        success: true,
        message: "The reset password link has been sent to your email.",
        data: result,
      });

    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }


 async resetPassword(req: Request, res: Response) {
  try {
    const token = req.params.token;
    const parsedData = ResetPasswordDto.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        success: false,
        message: z.prettifyError(parsedData.error),
      });
    }

    const result = await authservice.resetPassword(token, parsedData.data.newPassword);

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully.",
      data: result,
    });

  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
}

}
