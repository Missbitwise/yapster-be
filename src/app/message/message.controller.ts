import { Request, Response } from "express";

import {
  sendMessage,
  getConversationMessages,
  updateStatus,
} from "./message.service.js";

import { generateConversationId } from "../../common/utils/conversation.js";

export const sendMessageController = async (
  req: Request,
  res: Response
) => {
  try {
    const senderId = req.user?.userId;
    const receiverId = req.body.receiverId;
    const content = req.body.content;

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const conversationId =
      generateConversationId(
        senderId,
        receiverId
      );

    const message = await sendMessage(
      conversationId,
      senderId,
      receiverId,
      content
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error: any) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to send message",
    });
  }
};

export const getMessagesController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const otherUserId =
      req.params.userId as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const limitParam =
      req.query.limit as string | undefined;

    const cursor =
      req.query.cursor as string | undefined;

    let limit = 50;

    if (limitParam) {
      const parsedLimit =
        Number(limitParam);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Limit must be a positive integer",
        });
      }

      limit = Math.min(
        parsedLimit,
        100
      );
    }

    const conversationId =
      generateConversationId(
        userId,
        otherUserId
      );

    const result =
      await getConversationMessages(
        conversationId,
        userId,
        limit,
        cursor
      );

    return res.status(200).json({
      success: true,
      message:
        "Messages fetched successfully",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "GET MESSAGES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch messages",
    });
  }
};

export const updateMessageStatusController =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      const messageId =
        req.params.messageId as string;

      const { status } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!messageId) {
        return res.status(400).json({
          success: false,
          message:
            "Message ID is required",
        });
      }

      if (
        ![
          "sent",
          "delivered",
          "read",
        ].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message status",
        });
      }

      const message =
        await updateStatus(
          messageId,
          userId,
          status
        );

      return res.status(200).json({
        success: true,
        message:
          "Message status updated successfully",
        data: message,
      });
    } catch (error: any) {
      console.error(
        "UPDATE MESSAGE STATUS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update message status",
      });
    }
  };