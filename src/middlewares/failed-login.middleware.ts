import { NextFunction, Request, Response } from "express";

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000;

type FailedLoginState = {
  failures: number;
  blockedUntil?: number;
};

const failedLoginsByIp = new Map<string, FailedLoginState>();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function failedLoginBlocker(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const state = failedLoginsByIp.get(ip);

  if (!state?.blockedUntil) return next();

  const remainingMs = state.blockedUntil - Date.now();
  if (remainingMs <= 0) {
    failedLoginsByIp.delete(ip);
    return next();
  }

  res.setHeader("Retry-After", Math.ceil(remainingMs / 1000).toString());
  return res.status(429).json({
    success: false,
    message: "Too many invalid login attempts. Please try again after 5 minutes.",
  });
}

export function recordFailedLogin(req: Request): void {
  const ip = getClientIp(req);
  const state = failedLoginsByIp.get(ip) || { failures: 0 };
  state.failures += 1;

  if (state.failures >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }

  failedLoginsByIp.set(ip, state);
}

export function clearFailedLogins(req: Request): void {
  failedLoginsByIp.delete(getClientIp(req));
}

// Exported only to keep automated tests isolated.
export function resetFailedLoginTracker(): void {
  failedLoginsByIp.clear();
}
