import {createUserDto} from "../../dtos/auth.dto"
import z from "zod";
import {Request,Response} from "express";
import { AuthService } from "../../services/auth.services";
import { AdminUserService } from "../../services/admin/user.services";
import mongoose from "mongoose";
import { UserModel } from "../../models/user.model"; 



let authservice= new AuthService();
let adminUserService = new AdminUserService();

const toSafeUser = (user: any) => {
    const value = typeof user?.toObject === "function" ? user.toObject() : user;
    const { password, twoFactorSecret, ...safeUser } = value;
    return safeUser;
};

export class AdminUserController{
    async createUser(req: Request,res:Response){

        try{
            const parsedData = createUserDto.safeParse(req.body);
            if(!parsedData.success){
                return res.status(400).json(
                    {success: false, message: z.prettifyError(parsedData.error)}
                )
            }

            const newUser = await adminUserService.createUser(parsedData.data);
            return res.status(201).json(
                {success: true, data: toSafeUser(newUser), message: "Registered Success"}
            )
        }catch(error: Error | any){
            return res.status(500).json(
                { success: false, message: error.message || "Internal Server Error"}
            )
        }

    }

    // ADMIN LOGOUT
    async logoutUser(req: Request, res: Response) {
        try {
            // Allow admin logout without requiring a bearer token
            await authservice.logout();

            // Clear cookie if present
            try { res.clearCookie("token"); } catch (e) {}

            return res.status(200).json({ success: true, message: "Logout successful" });
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    }
    //  GET ALL USERS (Admin)
    async getAllUsers(req: Request, res: Response) {
        try {
            const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
            const limit = 10; // fixed 10 users per page
            const skip = (page - 1) * limit;

            const [users, total] = await Promise.all([
                UserModel.find()
                    .select("-password -twoFactorSecret")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                UserModel.countDocuments(),
            ]);

            const totalPages = Math.ceil(total / limit) || 1;

            return res.status(200).json({
                success: true,
                message: "Users fetched successfully",
                data: users,
                meta: {
                    total,
                    totalPages,
                    currentPage: page,
                    perPage: limit,
                },
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: "Error fetching users",
            });
        }
    }

    //  GET USER BY ID (Admin)
    async getUserById(req: Request, res: Response) {
        try {
            const { userid } = req.params;

            const user = await UserModel.findById(userid).select("-password -twoFactorSecret");

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "User fetched successfully",
                data: user,
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: "Error fetching user",
            });
        }
    }
    async updateUser(req: Request, res: Response) {
        try {
            const { userid } = req.params;

            //  Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(userid)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID format",
                });
            }

            //  Update user
            const updatedUser = await UserModel.findByIdAndUpdate(
                userid,
                req.body,
                { new: true } // return updated document
            ).select("-password -twoFactorSecret");

            //  If user not found
            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "User updated successfully",
                data: updatedUser,
            });

        } catch (error: any) {
            console.log("UPDATE USER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    }
    async deleteUser(req: Request, res: Response) {
        try {
            const { userid } = req.params;

            //  Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(userid)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID format",
                });
            }

            //  Delete user
            const deletedUser = await UserModel.findByIdAndDelete(userid);

            //  If user not found
            if (!deletedUser) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "User deleted successfully",
            });

        } catch (error: any) {
            console.log("DELETE USER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    }
}
