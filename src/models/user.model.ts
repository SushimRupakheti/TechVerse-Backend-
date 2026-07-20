 import mongoose,{Document,Schema} from "mongoose";
import {UserType} from "../types/user.type";

const userSchema: Schema = new Schema(
    {
            firstName: {type:String},
            lastName:{type:String},
            email:{type:String,required:true,unique:true},
            contactNo:{
                type:String,
                required:function(this: UserType) {
                    return this.authProvider === "local";
                }
            },
            address:{
                type:String,
                required:function(this: UserType) {
                    return this.authProvider === "local";
                }
            },
            password:{
                type:String,
                required:function(this: UserType) {
                    return this.authProvider === "local";
                }
            },
            googleId:{type:String,unique:true,sparse:true},
            authProvider:{type:String,enum:["local","google"],default:"local"},
            role: { type: String, enum: ["admin", "user", "customer"], default: "customer" },
            profileImage: { type: String,default: null},
            isVerified: { type: Boolean, default: false },
            emailVerifiedAt: { type: Date, default: null },
            twoFactorEnabled: { type: Boolean, default: false },
            twoFactorSecret: { type: String, default: null },
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
