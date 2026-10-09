import { Router } from "express";

import {
  sendMessageController,
  getMessagesController,
  updateMessageStatusController,
  markConversationAsReadController,
  getUnreadSummaryController,
} from "./message.controller.js";

import { authenticate } from "../../common/middlewares/auth.middleware.js";

const messageRoutes = Router();

messageRoutes.post(
  "/",
  authenticate,
  sendMessageController
);

messageRoutes.get(
  "/unread-summary",
  authenticate,
  getUnreadSummaryController
);

messageRoutes.patch(
  "/read-conversation/:contactId",
  authenticate,
  markConversationAsReadController
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