import { Request, Response } from "express";
import { getUserById, registerUser, loginUser } from "./user.service.js";


export const register = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    console.error("REGISTER USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await loginUser(req.body);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
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