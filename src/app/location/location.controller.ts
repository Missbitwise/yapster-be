import { Request, Response } from "express";
import {
  getEveryone,
  getNearbyUsers,
  getUserLocation,
  updateUserLocation,
} from "./location.service.js";

export const myLocation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const location = await getUserLocation(userId);
    return res.status(200).json({
      success: true,
      message: location ? "Saved location fetched successfully" : "No saved location",
      data: location,
    });
  } catch (error: any) {
    console.error("GET SAVED LOCATION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch saved location",
    });
  }
};

export const updateLocation = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const location = await updateUserLocation(
      userId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: location,
    });
  } catch (error: any) {
    console.error("UPDATE LOCATION ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update location",
    });
  }
};

export const nearbyUsers = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const radius = Number(req.query.radius ?? 5);

    const users = await getNearbyUsers(userId, radius);

    return res.status(200).json({
      success: true,
      message: "Nearby users fetched successfully",
      data: users,
    });
  } catch (error: any) {
    console.error("NEARBY USERS ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch nearby users",
    });
  }
};

export const everyoneUsers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.limit ?? 24);
    const result = await getEveryone(userId, page, pageSize);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("DISCOVER EVERYONE ERROR:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to discover users",
    });
  }
};
