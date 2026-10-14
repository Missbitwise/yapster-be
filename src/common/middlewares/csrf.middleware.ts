import { NextFunction, Request, Response } from "express";
import { getTrustedFrontendOrigins } from "../utils/auth-cookie.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const protectAgainstCsrf = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (safeMethods.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin || !getTrustedFrontendOrigins().includes(origin)) {
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed",
    });
  }

  return next();
};
