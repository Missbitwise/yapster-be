import { UpdateLocationDTO } from "./location.dto.js";
import { findNearbyUsers, upsertLocation } from "./location.repository.js";

export const updateUserLocation = async (
  userId: string,
  data: UpdateLocationDTO
) => {
  if (
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    throw new Error("Latitude and longitude are required");
  }

  if (data.latitude < -90 || data.latitude > 90) {
    throw new Error("Invalid latitude");
  }

  if (data.longitude < -180 || data.longitude > 180) {
    throw new Error("Invalid longitude");
  }

  return await upsertLocation(userId, data);
};

export const getNearbyUsers = async (
  userId: string,
  radiusKm: number
) => {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error("Radius must be greater than 0");
  }

  return await findNearbyUsers(userId, radiusKm);
};