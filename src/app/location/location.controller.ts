import { Request, Response } from "express";
import { getNearbyUsers, updateUserLocation } from "./location.service.js";

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