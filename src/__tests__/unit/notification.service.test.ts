import mongoose from "mongoose";

import { NotificationService } from "../../services/notification.service";
import { NotificationRepository } from "../../repositories/notification.repository";
import { UserRepository } from "../../repositories/auth.repository";

describe("NotificationService unit tests", () => {
  const service = new NotificationService();

  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1) getNotifications calls repository and returns result", async () => {
    const list = [{ _id: new mongoose.Types.ObjectId(), title: "t1" }] as any[];

    const spy = jest
      .spyOn(NotificationRepository.prototype, "findByUserId")
      .mockResolvedValue(list as any);

    const res = await service.getNotifications(userId);

    expect(spy).toHaveBeenCalledWith(userId);
    expect(res).toBe(list);
  });

  test("2) markAsRead throws 400 for invalid notification id", async () => {
    await expect(service.markAsRead(userId, "bad-id")).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid notification ID",
    });
  });

  test("3) markAsRead throws 403 when notification belongs to another user", async () => {
    jest
      .spyOn(NotificationRepository.prototype, "findById")
      .mockResolvedValue({ user: new mongoose.Types.ObjectId(otherUserId) } as any);

    await expect(
      service.markAsRead(userId, new mongoose.Types.ObjectId().toString())
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You can only update your own notifications",
    });
  });

  test("4) markAsRead updates notification and returns updated doc", async () => {
    const notifId = new mongoose.Types.ObjectId().toString();
    const found = { _id: notifId, user: new mongoose.Types.ObjectId(userId) } as any;

    jest
      .spyOn(NotificationRepository.prototype, "findById")
      .mockResolvedValue(found);

    const updated = { _id: notifId, isRead: true } as any;
    const markSpy = jest
      .spyOn(NotificationRepository.prototype, "markAsRead")
      .mockResolvedValue(updated);

    const res = await service.markAsRead(userId, notifId);

    expect(markSpy).toHaveBeenCalledWith(notifId);
    expect(res).toBe(updated);
  });

  test("5) deleteNotification throws 400 for invalid notification id", async () => {
    await expect(service.deleteNotification(userId, "not-valid")).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid notification ID",
    });
  });

  test("6) deleteNotification throws 404 when notification not found", async () => {
    const notifId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(NotificationRepository.prototype, "findById")
      .mockResolvedValue(null);

    await expect(service.deleteNotification(userId, notifId)).rejects.toMatchObject({
      statusCode: 404,
      message: "Notification not found",
    });
  });

  test("7) deleteNotification throws 403 when notification belongs to another user", async () => {
    const notifId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(NotificationRepository.prototype, "findById")
      .mockResolvedValue({ _id: notifId, user: new mongoose.Types.ObjectId(otherUserId) } as any);

    await expect(service.deleteNotification(userId, notifId)).rejects.toMatchObject({
      statusCode: 403,
      message: "You can only delete your own notifications",
    });
  });

  test("8) deleteNotification returns true when delete succeeds", async () => {
    const notifId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(NotificationRepository.prototype, "findById")
      .mockResolvedValue({ _id: notifId, user: new mongoose.Types.ObjectId(userId) } as any);

    const delSpy = jest
      .spyOn(NotificationRepository.prototype, "deleteById")
      .mockResolvedValue(true);

    const res = await service.deleteNotification(userId, notifId);

    expect(delSpy).toHaveBeenCalledWith(notifId);
    expect(res).toBe(true);
  });

  test("9) sendAdminCustomToAll throws 404 if there are no users", async () => {
    jest
      .spyOn(UserRepository.prototype, "getAllUsers")
      .mockResolvedValue([] as any);

    await expect(service.sendAdminCustomToAll("t", "m")).rejects.toMatchObject({
      statusCode: 404,
      message: "No users found",
    });
  });

  test("10) sendAdminCustomToAll creates notifications for all users", async () => {
    const u1 = { _id: new mongoose.Types.ObjectId() } as any;
    const u2 = { _id: new mongoose.Types.ObjectId() } as any;

    jest
      .spyOn(UserRepository.prototype, "getAllUsers")
      .mockResolvedValue([u1, u2] as any);

    const createManySpy = jest
      .spyOn(NotificationRepository.prototype, "createMany")
      .mockImplementation(async (docs: any[]) => docs as any);

    const res = await service.sendAdminCustomToAll("Hello", "World");

    expect(createManySpy).toHaveBeenCalledTimes(1);
    const docsArg = createManySpy.mock.calls[0][0];
    expect(docsArg).toHaveLength(2);
    expect(docsArg[0]).toEqual(
      expect.objectContaining({
        title: "Hello",
        message: "World",
        type: "ADMIN_CUSTOM",
        item: null,
        isRead: false,
      })
    );
    expect(res).toHaveLength(2);
  });
});
