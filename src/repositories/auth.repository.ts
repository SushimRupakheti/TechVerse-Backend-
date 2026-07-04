import { IUser, UserModel } from "../models/user.model";


export interface IUserRepository{
  createUser(data: Partial<IUser>):Promise <IUser>;
  getUserByEmail(email:string):Promise<IUser| null>;
  
  //additional methods
  getUserById(id:string):Promise<IUser| null>;
  getAllUsers():Promise<IUser[]>;
  updateUserById(id:string, data: Partial<IUser>):Promise<IUser | null>;
  deleteUserById(id:string):Promise<boolean>;
  
}

export class UserRepository implements IUserRepository{
    async createUser(data: Partial<IUser>){
        const newUser = new UserModel(data);
        await newUser.save(); // same as db.users.insertOne()
        return newUser;
    }
    async getUserByEmail(email: string){
        const user = await UserModel.findOne({ "email": email });
        return user;
    }

    async getUserById(id: string) {
        const user = await UserModel.findById(id);
        return user;
    }
    async getAllUsers(){
        const users = await UserModel.find();
        return users;
    }
    async updateUserById(id: string, data: Partial<IUser>){
        // UserModel.updateOne({ _id: id }, data);
        const updatedUser = 
            await UserModel.findByIdAndUpdate(id, data, { new: true });
        return updatedUser;
    }
     
    async deleteUserById(id: string){
        // UserModel.deleteOne({ _id: id });
        const result = await UserModel.findByIdAndDelete(id);
        return result ? true : false;

    }
}

