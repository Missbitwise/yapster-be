import { Router } from "express";
import {
  updateLocation,
  nearbyUsers,
} from "./location.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js"

const locationRoutes = Router();

locationRoutes.put(
  "/",
  authenticate,
  updateLocation
);

locationRoutes.get(
  "/nearby",
  authenticate,
  nearbyUsers
);

export default locationRoutes;