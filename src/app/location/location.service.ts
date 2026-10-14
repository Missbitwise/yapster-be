import { UpdateLocationDTO } from "./location.dto.js";
import {
  findEveryoneUsers,
  findNearbyUsers,
  findUserLocation,
  upsertLocation,
} from "./location.repository.js";

export const getUserLocation = async (userId: string) =>
  await findUserLocation(userId);

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

export const getEveryone = async (
  userId: string,
  page: number,
  pageSize: number
) => {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Page must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new Error("Page size must be between 1 and 50");
  }

  const rows = await findEveryoneUsers(
    userId,
    pageSize + 1,
    (page - 1) * pageSize
  );
  const hasMore = rows.length > pageSize;

  return {
    users: hasMore ? rows.slice(0, pageSize) : rows,
    page,
    pageSize,
    hasMore,
  };
};
