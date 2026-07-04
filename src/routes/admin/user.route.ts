import { Router } from "express";
import { AdminUserController } from "../../controllers/admin/user.contoller";
import { Request,Response } from "express";
import { authorizedMiddleWare, adminMiddleware } from "../../middlewares/authorized.middleware";


const router: Router = Router();
const adminUserController = new AdminUserController();

router.post('/register',authorizedMiddleWare, adminUserController.createUser);
router.post('/logout', adminUserController.logoutUser);

router.get(
    '/test',
    authorizedMiddleWare    ,
    (req:Request,res:Response)=>{
        res.send("test route works");
    }
);


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


