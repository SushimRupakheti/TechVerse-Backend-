import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { upload } from "../middlewares/upload-profile";

const router: Router = Router();
const authController = new AuthController();

router.post('/register', authController.registerUser);
router.post('/login',authController.loginUser);
router.post('/logout', authController.logoutUser);
router.put('/update/:id',authController.updateUser);
router.get('/:id', authController.getUserById);
// router.post("/:id/profile-picture", authController.uploadProfilePicture);
router.post("/:id/profile-picture",upload.single("profileImage"),authController.uploadProfilePicture);
router.post("/request-password-reset", authController.sendResetPasswordEmail);
router.post("/reset-password/:token", authController.resetPassword);

export default router;