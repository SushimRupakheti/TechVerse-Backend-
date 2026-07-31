import { UserRepository } from "../repositories/auth.repository";
import { createUserDto, LoginUserDto, PublicRegisterUserDto } from "../dtos/auth.dto";
import bycryptjs from "bcryptjs"
import { HttpError } from "../errors/http-error";
import { CLIENT_URL, JWT_SECRET } from "../config";
import  jwt  from "jsonwebtoken";
import { IUser } from "../models/user.model";
import { UserModel } from "../models/user.model";
import { sendEmail } from "../config/email";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import mongoose from "mongoose";


let userRepository =new UserRepository();

export class AuthService{

private generateEmailVerificationToken(user: IUser) {
    return jwt.sign(
        { id: user._id.toString(), purpose: "email-verification" },
        JWT_SECRET,
        { expiresIn: "24h" }
    );
}

private async sendVerificationEmail(user: IUser) {
    const token = this.generateEmailVerificationToken(user);
    const verificationLink = `${CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const html = `
        <p>Welcome to our platform.</p>
        <p>Please click the button below to verify your email address.</p>
        <p><a href="${verificationLink}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
    `;
    await sendEmail(user.email, "Verify your email", html);
}

generateLoginToken(user: IUser) {
    const payload={
        id: user._id,
        email: user.email,
        role:user.role,
    }
    return jwt.sign(payload,JWT_SECRET,{expiresIn:'30d'});
}

async registerUser(data:PublicRegisterUserDto){
    //logic to register user,duplicate check, hash
    const emailExists =await userRepository.getUserByEmail(data.email);
    if(emailExists){
        throw new HttpError(409,"email already registered");
    }
    if(!data.password){
        throw new HttpError(400,"Password is required");
    }

    //donot save plain text password, hash the pass
    const hashedPassword = await bycryptjs.hash(data.password,10);   //complexity
    const newUser = await userRepository.createUser({
        ...data,
        password: hashedPassword,
        authProvider: "local",
        role: "customer",
        isVerified: false,
        emailVerifiedAt: null,
    });
    await this.sendVerificationEmail(newUser);
    return newUser


    }  
    
async LoginUser(data:LoginUserDto){
    const user= await userRepository.getUserByEmail(data.email);
    if(!user){
        throw new HttpError(404,"user not found");
    }
    const authProvider = user.authProvider || "local";
    if(authProvider !== "local" || !user.password){
        throw new HttpError(400,"Please sign in with Google for this account");
    }
    const validPassword = await bycryptjs.compare(data.password,user.password);
    //plain text, hased, not data.password===user.passwprd
    if(!validPassword){
        throw new HttpError(404,"Invalid password");
    }
    if(!user.isVerified){
        throw new HttpError(403,"Please verify your email before logging in.");
    }

    if(user.twoFactorEnabled){
        return {
            twoFactorRequired: true,
            userId: user._id.toString(),
            email: user.email,
            user,
        };
    }

    //generate jwt token
    const token = this.generateLoginToken(user);
    return {token,user}
} 

async verifyEmail(token?: string) {
    if (!token) {
        throw new HttpError(400, "Verification token is required");
    }

    let decoded: jwt.JwtPayload;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (typeof payload === "string") {
            throw new Error("Invalid token payload");
        }
        decoded = payload;
    } catch {
        throw new HttpError(400, "Invalid or expired verification token");
    }

    if (decoded.purpose !== "email-verification" || typeof decoded.id !== "string") {
        throw new HttpError(400, "Invalid or expired verification token");
    }

    const user = await userRepository.getUserById(decoded.id);
    if (!user) {
        throw new HttpError(400, "Invalid or expired verification token");
    }
    if (user.isVerified) {
        return { alreadyVerified: true, user };
    }

    const updatedUser = await userRepository.updateUserById(decoded.id, {
        isVerified: true,
        emailVerifiedAt: new Date(),
    });
    if (!updatedUser) {
        throw new HttpError(400, "Invalid or expired verification token");
    }
    return { alreadyVerified: false, user: updatedUser };
}

async resendVerification(email: string) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
        // Avoid disclosing whether an email address is registered.
        return { sent: false, alreadyVerified: false };
    }
    if (user.isVerified) {
        return { sent: false, alreadyVerified: true };
    }

    await this.sendVerificationEmail(user);
    return { sent: true, alreadyVerified: false };
}

async enableTwoFactor(userId:string){
    const user = await userRepository.getUserById(userId);
    if(!user){
        throw new HttpError(404,"User not found");
    }
    if(user.twoFactorEnabled){
        throw new HttpError(400,"2FA is already enabled");
    }

    const secret = speakeasy.generateSecret({
        name: `Recell Bazar (${user.email})`,
        issuer: "Recell Bazar",
    });

    if(!secret.otpauth_url){
        throw new HttpError(500,"Could not generate 2FA setup URL");
    }

    await userRepository.updateUserById(userId,{
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
        otpauthUrl: secret.otpauth_url,
        qrCode,
    };
}

async verifyTwoFactorSetup(userId:string, otp:string){
    const user = await userRepository.getUserById(userId);
    if(!user){
        throw new HttpError(404,"User not found");
    }
    if(!user.twoFactorSecret){
        throw new HttpError(400,"2FA setup has not been started");
    }

    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: otp,
        window: 1,
    });

    if(!verified){
        throw new HttpError(400,"Invalid OTP");
    }

    const updatedUser = await userRepository.updateUserById(userId,{
        twoFactorEnabled: true,
    });

    return updatedUser;
}

async verifyTwoFactorLogin(data:{ email?: string; userId?: string; otp: string }){
    const user = data.userId
        ? await userRepository.getUserById(data.userId)
        : data.email
            ? await userRepository.getUserByEmail(data.email)
            : null;

    if(!user){
        throw new HttpError(404,"user not found");
    }
    if(!user.twoFactorEnabled || !user.twoFactorSecret){
        throw new HttpError(400,"2FA is not enabled for this user");
    }

    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: data.otp,
        window: 1,
    });

    if(!verified){
        throw new HttpError(400,"Invalid OTP");
    }

    const token = this.generateLoginToken(user);
    return {token,user};
}

async disableTwoFactor(userId:string, password:string){
    const user = await userRepository.getUserById(userId);
    if(!user){
        throw new HttpError(404,"User not found");
    }

    const authProvider = user.authProvider || "local";
    if(authProvider !== "local" || !user.password){
        throw new HttpError(400,"Password verification is not available for this account");
    }

    const validPassword = await bycryptjs.compare(password,user.password);
    if(!validPassword){
        throw new HttpError(404,"Invalid password");
    }

    const updatedUser = await userRepository.updateUserById(userId,{
        twoFactorEnabled: false,
        twoFactorSecret: null,
    });

    return updatedUser;
}

async updateUser(userId:string, data:Partial<createUserDto>){
    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new HttpError(400,"Invalid user id");
    }
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



async getUserById(userId: string) {
    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new HttpError(400, "Invalid user id");
    }

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
            return { sent: false };
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' }); // 1 hour expiry
        const resetLink = `${CLIENT_URL}/reset-password?token=${token}`;
        const html = `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>`;
        await sendEmail(user.email, "Password Reset", html);
        return { sent: true };

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
            return { reset: true };
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
