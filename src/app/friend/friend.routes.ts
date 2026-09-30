import { Router } from "express";

import {
  sendRequest,
  getReceivedRequests,
  respondRequest,
  getMyFriends,
  blockUserController,
} from "./friend.controller.js";

import { authenticate } from "../../common/middlewares/auth.middleware.js"

const friendRoutes = Router();

friendRoutes.post(
  "/requests/:receiverId",
  authenticate,
  sendRequest
);

friendRoutes.get(
  "/requests",
  authenticate,
  getReceivedRequests
);

friendRoutes.patch(
  "/requests/:requestId",
  authenticate,
  respondRequest
);

friendRoutes.get(
  "/",
  authenticate,
  getMyFriends
);

friendRoutes.post(
  "/block/:userId",
  authenticate,
  blockUserController
);

export default friendRoutes;