import { CookieOptions } from "express";

export const AUTH_COOKIE_NAME = "yapster_token";
export const AUTH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: AUTH_TOKEN_MAX_AGE,
};

export const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

export const getTrustedFrontendOrigins = (): string[] =>
  [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://yapster-fe.vercel.app",
    ...(process.env.FRONTEND_URL?.split(",") ?? []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean);
