import { Router } from "express";

import {
  sendRequest,
  getReceivedRequests,
  getSentRequests,
  cancelRequest,
  respondRequest,
  getMyFriends,
  blockUserController,
  unblockUserController,
  getBlockedUsersController,
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

friendRoutes.get(
  "/requests/sent",
  authenticate,
  getSentRequests
);

friendRoutes.delete(
  "/requests/:requestId",
  authenticate,
  cancelRequest
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

friendRoutes.delete(
  "/block/:userId",
  authenticate,
  unblockUserController
);

friendRoutes.get(
  "/blocked",
  authenticate,
  getBlockedUsersController
);

export default friendRoutes;