import { AuthService } from "../services/auth.services";
import { createUserDto, LoginUserDto } from "../dtos/auth.dto";
import z from "zod";
import { Request, Response } from "express";
import { Request as MulterRequest } from "express";



let authservice = new AuthService();

export class AuthController {
  async registerUser(req: Request, res: Response) {
    try {
      const parsedData = createUserDto.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json(
          { success: false, message: z.prettifyError(parsedData.error) }
        )
      }

      const newUser = await authservice.registerUser(parsedData.data);
      return res.status(201).json(
        { success: true, data: newUser, message: "Registered Success" }
      )
    } catch (error: Error | any) {
      return res.status(500).json(
        { success: false, message: error.message || "Inernal Server Error" }
      )
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

      const { token, user } = await authservice.LoginUser(parsedData.data);
      // Exclude password from response
      const { password, ...userWithoutPassword } = user.toObject();
      return res.status(200).json({
        success: true,
        data: userWithoutPassword,
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

  async logoutUser(req: Request, res: Response) {
    try {
      // Allow logout without a token: call logout unconditionally
      await authservice.logout();

      // Clear cookie if present (no-op if cookies not configured)
      try { res.clearCookie("token"); } catch (e) {}

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
      const updateData = req.body;
      const updatedUser = await authservice.updateUser(userId, updateData);
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


  async uploadProfilePicture(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const profileImagePath = `/uploads/${file.filename}`;

      const updatedUser = await authservice.updateProfileImage(userId, profileImagePath);

      return res.status(200).json({
        success: true,
        data: updatedUser,
        message: "Profile picture uploaded successfully",
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
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
    const { newPassword } = req.body;

    const result = await authservice.resetPassword(token, newPassword);

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