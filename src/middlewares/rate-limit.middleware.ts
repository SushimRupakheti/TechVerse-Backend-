import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";

type RateLimiterOptions = {
  windowMs: number;
  limit: number;
  message: string;
  identifier: string;
};

const createRateLimiter = ({
  windowMs,
  limit,
  message,
  identifier,
}: RateLimiterOptions): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message,
      }),
  });

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  identifier: "login",
  message: "Too many login attempts. Please try again after 15 minutes.",
});

export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  identifier: "signup",
  message: "Too many signup attempts. Please try again after 1 hour.",
});

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  identifier: "forgot-password",
  message: "Too many password reset requests. Please try again after 30 minutes.",
});

export const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  limit: 10,
  identifier: "reset-password",
  message: "Too many reset password attempts. Please try again after 30 minutes.",
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  identifier: "payment",
  message: "Too many payment requests. Please try again later.",
});
