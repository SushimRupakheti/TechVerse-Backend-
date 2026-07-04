import { UserRepository } from "../repositories/auth.repository";
import { createUserDto, LoginUserDto } from "../dtos/auth.dto";
import bycryptjs from "bcryptjs"
import { HttpError } from "../errors/http-error";
import { JWT_SECRET } from "../config";
import  jwt  from "jsonwebtoken";
import { IUser } from "../models/user.model";
import { UserModel } from "../models/user.model";
import { sendEmail } from "../config/email";
import dotenv from "dotenv";
dotenv.config();


const CLIENT_URL = process.env.CLIENT_URL as string;
let userRepository =new UserRepository();

export class AuthService{

async registerUser(data:createUserDto){
    //logic to register user,duplicate check, hash
    const emailExists =await userRepository.getUserByEmail(data.email);
    if(emailExists){
        throw new HttpError(409,"email already registered");
    }

    //donot save plain text password, hash the pass
    const hashedPassword = await bycryptjs.hash(data.password,10);   //complexity
    data.password =hashedPassword;  //replace plain text with hashed password
    const newUser = await userRepository.createUser(data);
    return newUser


    }  
    
async LoginUser(data:LoginUserDto){
    const user= await userRepository.getUserByEmail(data.email);
    if(!user){
        throw new HttpError(404,"user not found");
    }
    const validPassword = await bycryptjs.compare(data.password,user.password);
    //plain text, hased, not data.password===user.passwprd
    if(!validPassword){
        throw new HttpError(404,"Invalid password");
    }
    //generate jwt token 
    const payload={
        id: user._id,
        email: user.email,
        role:user.role,
    }
    const token = jwt.sign(payload,JWT_SECRET,{expiresIn:'30d'});
    return {token,user}
} 

async updateUser(userId:string, data:Partial<createUserDto>){
    // Hash password if it's being updated
    if(data.password){
        data.password = await bycryptjs.hash(data.password, 10);
    }
    const updatedUser = await userRepository.updateUserById(userId,data);   
    if(!updatedUser){
        throw new HttpError(404,"User not found");
    }
    return updatedUser;
}


async updateProfileImage(userId: string, imagePath: string) {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { profileImage: imagePath },
    { new: true }
  );

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

async getUserById(userId: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) {
        throw new HttpError(404, "User not found");
    }
    return user;
}

    async sendResetPasswordEmail(email?: string) {
        if (!email) {
            throw new HttpError(400, "Email is required");
        }
        const user = await userRepository.getUserByEmail(email);
        if (!user) {
            throw new HttpError(404, "User not found");
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' }); // 1 hour expiry
        const resetLink = `${CLIENT_URL}/reset-password?token=${token}`;
        const html = `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>`;
        await sendEmail(user.email, "Password Reset", html);
        return user;

    }

    async resetPassword(token?: string, newPassword?: string) {
        try {
            if (!token || !newPassword) {
                throw new HttpError(400, "Token and new password are required");
            }
            const decoded: any = jwt.verify(token, JWT_SECRET);
            const userId = decoded.id;
            const user = await userRepository.getUserById(userId);
            if (!user) {
                throw new HttpError(404, "User not found");
            }
            const hashedPassword = await bycryptjs.hash(newPassword, 10);
            await userRepository.updateUserById(userId, { password: hashedPassword });
            return user;
        } catch (error) {
            throw new HttpError(400, "Invalid or expired token");
        }
    }



    async logout(token?: string) {
        // Stateless JWTs don't require server-side logout by default.
        // This stub exists to allow future token revocation/blacklisting.
        // If you store refresh tokens or maintain a blacklist, add logic here.
        return { success: true, message: "Logged out" };
    }
}