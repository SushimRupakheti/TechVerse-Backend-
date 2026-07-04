import { Router } from "express";
import { AdminItemController } from "../../controllers/admin/item.controller";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";

const router = Router();
const adminItemController = new AdminItemController();

router.get(
  "/",
  authorizedMiddleWare,
  adminMiddleware,
  (req, res) => adminItemController.getAllItems(req, res)
);

router.get(
  "/:itemid",
  authorizedMiddleWare,
  adminMiddleware,
  (req, res) => adminItemController.getItemById(req, res)
);

router.put(
  "/:itemid",
  authorizedMiddleWare,
  adminMiddleware,
  (req, res) => adminItemController.updateItem(req, res)
);

router.put(
  "/:itemid/status",
  authorizedMiddleWare,
  adminMiddleware,
  (req, res) => adminItemController.updateStatus(req, res)
);

router.delete(
  "/:itemid",
  authorizedMiddleWare,
  adminMiddleware,
  (req, res) => adminItemController.deleteItem(req, res)
);

export default router;
