import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import HTTP_STATUS from 'http-status-codes';

/**
 * App-wide rate limiter (CodeQL js/missing-rate-limiting).
 *
 * Generous ceiling intended as a baseline safety net for every route
 * (including the Socket.IO/Bull-board mounts in src/routes.ts) rather than
 * a strict per-endpoint control — sensitive endpoints get their own,
 * tighter limiter (see `authLimiter` below) layered on top of this one.
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

/**
 * Stricter limiter for the unauthenticated auth endpoints
 * (signup/signin/forgot-password/reset-password) — these are classic
 * credential-stuffing / brute-force / account-enumeration targets, so they
 * get a much lower ceiling than the rest of the API.
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});
