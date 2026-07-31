import {
  NotificationModel,
  INotification,
} from "../models/notification.model";

export interface INotificationRepository {
  create(data: Partial<INotification>): Promise<INotification>;
  createMany(docs: Partial<INotification>[]): Promise<INotification[]>;
  findByUserId(userId: string, skip?: number, limit?: number): Promise<INotification[]>;
  countByUserId(userId: string): Promise<number>;
  findById(id: string): Promise<INotification | null>;
  markAsRead(id: string): Promise<INotification | null>;
  deleteById(id: string): Promise<boolean>;
}

export class NotificationRepository implements INotificationRepository {
  async create(data: Partial<INotification>) {
    const notification = new NotificationModel(data);
    await notification.save();
    return notification;
  }

  async createMany(docs: Partial<INotification>[]) {
    const created = await NotificationModel.insertMany(docs);
    return created as unknown as INotification[];
  }

  async findByUserId(userId: string, skip = 0, limit = 20) {
    return await NotificationModel.find({ user: userId })
      .populate({
        path: "item",
        select: "phoneModel category photos finalPrice status",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByUserId(userId: string) {
    return await NotificationModel.countDocuments({ user: userId });
  }

  async findById(id: string) {
    return await NotificationModel.findById(id);
  }

  async markAsRead(id: string) {
    return await NotificationModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
  }

  async deleteById(id: string) {
    const result = await NotificationModel.findByIdAndDelete(id);
    return result ? true : false;
  }
}
