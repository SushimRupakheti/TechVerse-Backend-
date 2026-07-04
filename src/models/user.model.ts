 import mongoose,{Document,Schema} from "mongoose";
import {UserType} from "../types/user.type";

const userSchema: Schema = new Schema(
    {
            firstName: {type:String},
            lastName:{type:String},
            email:{type:String,required:true,unique:true},
            contactNo:{type:String,required:true},
            address:{type:String,required:true},
            password:{type:String},
            role: { type: String, enum: ["admin", "user"], default: "user" },
            profileImage: { type: String,default: null},
    },
    {
        timestamps:true, //autocreatedAt and updatedAt
    }
)

export interface IUser extends UserType,Document{
    _id: mongoose.Types.ObjectId;
    createdAt:Date;
    updatedAt:Date;
}

export const UserModel =mongoose.model<IUser>('User',userSchema);
//collection name "users" (plural of "User")
//UserModel -> db.users