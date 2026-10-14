import { Request, Response } from "express";
import { getUserById, registerUser, loginUser, updateUserProfile, createAuthToken } from "./user.service.js";
import { authCookieOptions, clearAuthCookieOptions, AUTH_COOKIE_NAME } from "../../common/utils/auth-cookie.js";

const isUsernameConflict = (error: any) =>
  error?.code === "23505" &&
  (error?.constraint === "users_username_lower_unique" ||
    error?.constraint === "users_username_key" ||
    String(error?.detail || "").toLowerCase().includes("username"));

const usernameConflictMessage = "Username already exists. Please choose another username.";


export const register = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);
    res.cookie(AUTH_COOKIE_NAME, createAuthToken(user.id), authCookieOptions);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error: any) {
    console.error("REGISTER USER ERROR:", error);

    if (isUsernameConflict(error)) {
      return res.status(409).json({ success: false, message: usernameConflictMessage });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
    return res.status(400).json({ success: false, message: "Email cannot be changed." });
  }
  try {
    const user = await updateUserProfile(userId, req.body);
    return res.status(200).json({ success: true, message: "Profile updated successfully", data: user });
  } catch (error: any) {
    if (isUsernameConflict(error)) {
      return res.status(409).json({ success: false, message: usernameConflictMessage });
    }
    console.error("UPDATE USER PROFILE ERROR:", error);
    return res.status(error.message === "User not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await loginUser(req.body);
    res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user: result.user },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);
  return res.status(200).json({ success: true, message: "Logout successful" });
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await getUserById(userId);

    return res.status(200).json({
      success: true,
      message: "Authenticated user",
      data: user,
    });
  } catch (error: any) {
    console.error("GET ME ERROR:", error);

    return res.status(404).json({
      success: false,
      message: error.message || "User not found",
    });
  }
};
