import mongoose, { Document, Schema } from "mongoose";

const notificationSchema: Schema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["APPROVED", "REJECTED", "SOLD", "ADMIN_CUSTOM"],
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for fast user-based queries sorted by newest first
notificationSchema.index({ user: 1, createdAt: -1 });

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "APPROVED" | "REJECTED" | "SOLD" | "ADMIN_CUSTOM";
  item: mongoose.Types.ObjectId | null;
  isRead: boolean;
  createdAt: Date;
}

export const NotificationModel = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
