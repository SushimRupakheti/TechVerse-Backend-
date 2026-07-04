import mongoose, { Document, Schema } from "mongoose";

export interface IPayment extends Document {
  fullName: string;
  phoneNo: string;
  email: string;
  phoneModel: string;
  sellerId: string;
  price: number;
  location: string;
  date: string;
  time: string;
  oid: string;
  refId: string;
  amt: string;
  status: string;
  raw: string;
  createdAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    fullName: { type: String, required: true },
    phoneNo: { type: String, required: true },
    email: { type: String, required: true },
    phoneModel: { type: String, required: true },
    sellerId: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    oid: { type: String },
    refId: { type: String, index: true, unique: true, sparse: true },
    amt: { type: String },
    status: { type: String },
    raw: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PaymentModel = mongoose.model<IPayment>("Payment", PaymentSchema);
