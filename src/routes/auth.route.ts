import { NextFunction, Request, Response, Router } from "express";
import passport from "passport";
import { AuthController } from "../controllers/auth.controller";
import { authorizedMiddleWare } from "../middlewares/authorized.middleware";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  resetPasswordRateLimiter,
  resendVerificationRateLimiter,
  signupRateLimiter,
} from "../middlewares/rate-limit.middleware";
import { FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../config";
import { failedLoginBlocker } from "../middlewares/failed-login.middleware";

const router: Router = Router();
const authController = new AuthController();

const requireGoogleOAuthConfig = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-TechVerse-Route", "google-oauth");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Google OAuth is not configured on the server.",
    });
  }

  return next();
};

const setObjectIdParam = (req: Request, _res: Response, next: NextFunction) => {
  req.params.id = req.params[0];
  return next();
};

router.get(
  "/google",
  requireGoogleOAuthConfig,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false,
  })
);

router.get(
  "/google/callback",
  requireGoogleOAuthConfig,
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login?oauth=failed`,
    session: false,
  }),
  authController.googleCallback
);

router.get("/me", authorizedMiddleWare, authController.getMe);
router.patch("/profile", authorizedMiddleWare, authController.updateProfile);
router.post('/register', signupRateLimiter, authController.registerUser);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', resendVerificationRateLimiter, authController.resendVerification);
router.post('/login', failedLoginBlocker, loginRateLimiter, authController.loginUser);
router.post('/2fa/enable', authorizedMiddleWare, authController.enableTwoFactor);
router.post('/2fa/verify-setup', authorizedMiddleWare, authController.verifyTwoFactorSetup);
router.post('/verify-2fa', authController.verifyTwoFactorLogin);
router.post('/2fa/disable', authorizedMiddleWare, authController.disableTwoFactor);
router.post('/logout', authController.logoutUser);
router.post("/request-password-reset", forgotPasswordRateLimiter, authController.sendResetPasswordEmail);
router.post("/reset-password/:token", resetPasswordRateLimiter, authController.resetPassword);
router.put(/^\/update\/([0-9a-fA-F]{24})$/, authorizedMiddleWare, setObjectIdParam, authController.updateUser);
router.get(/^\/([0-9a-fA-F]{24})$/, setObjectIdParam, authController.getUserById);

export default router;
