import { Request, Response, Router } from "express";
import { ItemController } from "../controllers/item.controller";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";
import { uploadRateLimiter } from "../middlewares/rate-limit.middleware";
import {
  handleUploadErrors,
  secureImageUpload,
  validateAndStoreImages,
} from "../middlewares/secure-image-upload.middleware";

const router = Router();
const itemController = new ItemController();

// Create Item (Protected)
router.post("/", authorizedMiddleWare, (req, res) =>
  itemController.createItem(req, res)
);

// Legacy single-photo upload. Protected, rate-limited, stored outside public web root.
router.post(
  "/upload-photo",
  authorizedMiddleWare,
  uploadRateLimiter,
  secureImageUpload.single("itemPhoto"),
  handleUploadErrors,
  validateAndStoreImages,
  (req: Request, res: Response) => {
    const image = req.storedImages?.[0];
    if (!image) {
      return res.status(400).json({ success: false, message: "No image uploaded." });
    }
    return res.status(200).json({ success: true, fileName: image.fileName, url: image.url });
  }
);

// Multi-image upload. Max 5 images, each max 5 MB, same secure validation pipeline.
router.post(
  "/upload-images",
  authorizedMiddleWare,
  uploadRateLimiter,
  secureImageUpload.array("images", 5),
  handleUploadErrors,
  validateAndStoreImages,
  (req: Request, res: Response) => {
    const images = req.storedImages ?? [];
    return res.status(200).json({
      success: true,
      images: images.map((image) => ({ fileName: image.fileName, url: image.url })),
    });
  }
);

// Public GET routes
router.get("/", (req, res) => itemController.getAllItems(req, res));

// GET items by userId (e.g. /items/user/:userId)
router.get("/user/:userId", (req, res) =>
  itemController.getItemsByUserId(req, res)
);

// Update item (Protected, owner-only enforced in controller/service)
router.put("/:id", authorizedMiddleWare, (req, res) =>
  itemController.updateItem(req, res)
);

// Delete item (Protected, owner-only enforced in controller/service)
router.delete("/:id", authorizedMiddleWare, (req, res) =>
  itemController.deleteItem(req, res)
);

router.get("/:id", (req, res) => itemController.getItemById(req, res));

export default router;