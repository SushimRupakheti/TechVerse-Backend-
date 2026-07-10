import fs from "fs";
import path from "path";
import { Router } from "express";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";
import { uploadRateLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();
const PRIVATE_UPLOAD_ROOT = path.resolve(process.cwd(), "private-uploads", "images");
const SAFE_IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

router.get(
  "/images/:fileName",
  authorizedMiddleWare,
  uploadRateLimiter,
  async (req, res) => {
    const fileName = path.basename(req.params.fileName || "");
    if (!SAFE_IMAGE_NAME.test(fileName)) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }

    const filePath = path.join(PRIVATE_UPLOAD_ROOT, fileName);
    if (!filePath.startsWith(PRIVATE_UPLOAD_ROOT)) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      res.setHeader("Content-Type", CONTENT_TYPE_BY_EXTENSION[path.extname(fileName).toLowerCase()] || "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      return res.sendFile(filePath);
    } catch {
      return res.status(404).json({ success: false, message: "Image not found." });
    }
  }
);

export default router;