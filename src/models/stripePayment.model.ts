import mongoose, { Document, Schema } from "mongoose";

export interface IStripePayment extends Document {
  sessionId?: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  metadata?: any;
  productId?: string;
  orderId?: string;
  buyerName?: string;
  buyerPhone?: string;
  itemSnapshot?: any;
  status: string;
  raw?: any;
  createdAt: Date;
}

const StripePaymentSchema: Schema = new Schema(
  {
    sessionId: { type: String },
    paymentIntentId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    customerEmail: { type: String },
    metadata: { type: Schema.Types.Mixed },
    productId: { type: String },
    orderId: { type: String },
    buyerName: { type: String },
    buyerPhone: { type: String },
    itemSnapshot: { type: Schema.Types.Mixed },
    status: { type: String },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

StripePaymentSchema.index({ sessionId: 1 }, { unique: true, sparse: true });
StripePaymentSchema.index({ paymentIntentId: 1 }, { unique: true, sparse: true });

export const StripePaymentModel = mongoose.model<IStripePayment>("StripePayment", StripePaymentSchema);
