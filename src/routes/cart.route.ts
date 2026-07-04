import { Router } from "express";
import { CartController } from "../controllers/cart.controller";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";

const router: Router = Router();
const cartController = new CartController();

// All cart routes are protected by authentication middleware
router.use(authorizedMiddleWare);

router.post("/add", cartController.addToCart);
router.get("/", cartController.getCart);
router.delete("/remove/:id", cartController.removeCartItem);

export default router;
