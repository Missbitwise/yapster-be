import { Router } from "express";
import {
  everyoneUsers,
  myLocation,
  updateLocation,
  nearbyUsers,
} from "./location.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js"

const locationRoutes = Router();

locationRoutes.get("/me", authenticate, myLocation);

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

locationRoutes.get("/everyone", authenticate, everyoneUsers);

export default locationRoutes;
