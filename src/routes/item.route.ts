// import { Router } from "express";
// import { ItemController } from "../controllers/item.controller";
// import { authorizedMiddleWare } from "../middlewares/authorized.middleware";
// import { upload } from "../middlewares/upload-profile";

// const router = Router();
// const itemController = new ItemController();

// // Create Item (Protected)
// router.post("/", authorizedMiddleWare, (req, res) =>
//   itemController.createItem(req, res)
// );

// // Public Routes
// router.get("/", (req, res) => itemController.getAllItems(req, res));
// router.get("/:id", (req, res) => itemController.getItemById(req, res));


// // Upload Photo Route (Protected)
// router.post(
//   "/upload-photo",
//   authorizedMiddleWare,
//   upload.single("itemPhoto"),
//   (req, res) => {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No photo uploaded",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       url: `/uploads/${req.file.filename}`,
//     });
//   }
// );



// export default router;


// routes/item.routes.ts
import { Router } from "express";
import { ItemController } from "../controllers/item.controller";
import { upload } from "../middlewares/upload-profile";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";

const router = Router();
const itemController = new ItemController();

// Create Item (Protected)
router.post("/", authorizedMiddleWare, (req, res) =>
  itemController.createItem(req, res)
);

// Upload Photo Route (Protected)
router.post(
  "/upload-photo",
  authorizedMiddleWare,
  upload.single("itemPhoto"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No photo uploaded" });
    }
    return res.status(200).json({ success: true, url: `/uploads/${req.file.filename}` });
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

