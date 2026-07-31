import { Router } from "express";
import { AdminUserController } from "../../controllers/admin/user.contoller";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";


const router: Router = Router();
const adminUserController = new AdminUserController();

router.post('/register', authorizedMiddleWare, adminMiddleware, adminUserController.createUser);


router.get(
  "/",
  authorizedMiddleWare,
  adminMiddleware,
  adminUserController.getAllUsers
); 

router.get(
  "/:userid",
  authorizedMiddleWare,
  adminMiddleware,
  adminUserController.getUserById
);
// UPDATE USER
router.put(
  "/:userid",
  authorizedMiddleWare,
  adminMiddleware,
  adminUserController.updateUser
);

// DELETE USER
router.delete(
  "/:userid",
  authorizedMiddleWare,
  adminMiddleware,
  adminUserController.deleteUser
);


export default router;


