import { UserRepository } from "../../repositories/auth.repository";
import { createUserDto } from "../../dtos/auth.dto";
import { HttpError } from "../../errors/http-error";
import bcryptjs from "bcryptjs";
import mongoose from "mongoose";

let userRepository = new UserRepository();
export class AdminUserService {
    async createUser(data: createUserDto) {
                const emailExists = await userRepository.getUserByEmail(data.email);
                if(emailExists){ // if instance found, duplicate
                    throw new HttpError(409, "Email already exists");
                }
                // donot save plain text password, hash the password
                const hashedPassword = await bcryptjs.hash(data.password, 10); // 10 - complexity
                data.password = hashedPassword; // replace plain text with hashed password
                const newUser = await userRepository.createUser(data);
                return newUser;
    }
    async getAllUsers() {
        // logic to get all users
        let users = await userRepository.getAllUsers();
        // transform data if needed
        return users;
    }
    async getUserById(userId: string) {
        // logic to get user by id
        let user = await userRepository.getUserById(userId);
        if(!user) {
            throw new HttpError(404, "User not found");
        }
        return user;
    }
    // ✅ UPDATE USER
    async updateUser(userId: string, updateData: Partial<createUserDto>) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, "Invalid user ID format");
    }

    // Prevent password update directly
    if (updateData.password) delete updateData.password;

    const updatedUser = await userRepository.updateUserById(userId, updateData);
    if (!updatedUser) throw new HttpError(404, "User not found");

    return updatedUser;
  }

  async deleteUser(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, "Invalid user ID format");
    }

    const deleted = await userRepository.deleteUserById(userId);
    if (!deleted) throw new HttpError(404, "User not found");

    return true;
  }
  
}