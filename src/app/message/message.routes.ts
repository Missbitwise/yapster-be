import { Router } from "express";

import {
  sendMessageController,
  getMessagesController,
  updateMessageStatusController,
} from "./message.controller.js";

import { authenticate } from "../../common/middlewares/auth.middleware.js";

const messageRoutes = Router();

messageRoutes.post(
  "/",
  authenticate,
  sendMessageController
);

messageRoutes.get(
  "/:userId",
  authenticate,
  getMessagesController
);

messageRoutes.patch(
  "/:messageId/status",
  authenticate,
  updateMessageStatusController
);

export default messageRoutes;