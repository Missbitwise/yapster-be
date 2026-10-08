import { Request, Response } from "express";

import {
  blockUser,
  getBlockedUsers,
  getFriends,
  getReceivedFriendRequests,
  getSentFriendRequests,
  cancelSentFriendRequest,
  respondToFriendRequest,
  sendFriendRequest,
  unblockUser,
} from "./friend.service.js";

export const sendRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const senderId = req.user?.userId;
    const receiverId =
      req.params.receiverId as string;

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message:
          "Receiver ID is required",
      });
    }

    const request =
      await sendFriendRequest(
        senderId,
        receiverId
      );

    return res.status(201).json({
      success: true,
      message:
        "Friend request sent successfully",
      data: request,
    });
  } catch (error: any) {
    console.error(
      "SEND FRIEND REQUEST ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to send friend request",
    });
  }
};

export const getReceivedRequests = async (
  req: Request,
  res: Response
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const requests =
      await getReceivedFriendRequests(
        userId
      );

    return res.status(200).json({
      success: true,
      message:
        "Friend requests fetched successfully",
      data: requests,
    });
  } catch (error: any) {
    console.error(
      "GET FRIEND REQUESTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch friend requests",
    });
  }
};

export const getSentRequests = async (
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

    const requests = await getSentFriendRequests(userId);

    return res.status(200).json({
      success: true,
      message: "Sent friend requests fetched successfully",
      data: requests,
    });
  } catch (error: any) {
    console.error("GET SENT FRIEND REQUESTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch sent friend requests",
    });
  }
};

export const cancelRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const senderId = req.user?.userId;
    const requestId = req.params.requestId as string;

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    const result = await cancelSentFriendRequest(senderId, requestId);

    return res.status(200).json({
      success: true,
      message: "Friend request cancelled successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("CANCEL FRIEND REQUEST ERROR:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel friend request",
    });
  }
};

export const respondRequest = async (
  req: Request,
  res: Response
) => {
  try {
    const userId =
      req.user?.userId;

    const requestId =
      req.params.requestId as string;

    const { action } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message:
          "Request ID is required",
      });
    }

    if (
      action !== "accept" &&
      action !== "reject"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Action must be accept or reject",
      });
    }

    const result =
      await respondToFriendRequest(
        userId,
        requestId,
        action
      );

    return res.status(200).json({
      success: true,
      message:
        action === "accept"
          ? "Friend request accepted successfully"
          : "Friend request rejected successfully",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "RESPOND FRIEND REQUEST ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to respond to friend request",
    });
  }
};

export const getMyFriends = async (
  req: Request,
  res: Response
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const friends =
      await getFriends(userId);

    return res.status(200).json({
      success: true,
      message:
        "Friends fetched successfully",
      data: friends,
    });
  } catch (error: any) {
    console.error(
      "GET FRIENDS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch friends",
    });
  }
};

export const blockUserController = async (
  req: Request,
  res: Response
) => {
  try {
    const blockerId =
      req.user?.userId;

    const blockedId =
      req.params.userId as string;

    if (!blockerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required",
      });
    }

    const blockedUser =
      await blockUser(
        blockerId,
        blockedId
      );

    return res.status(201).json({
      success: true,
      message:
        "User blocked successfully",
      data: blockedUser,
    });
  } catch (error: any) {
    console.error(
      "BLOCK USER ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to block user",
    });
  }
};

export const unblockUserController = async (
  req: Request,
  res: Response
) => {
  try {
    const blockerId =
      req.user?.userId;

    const blockedId =
      req.params.userId as string;

    if (!blockerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required",
      });
    }

    const result =
      await unblockUser(
        blockerId,
        blockedId
      );

    return res.status(200).json({
      success: true,
      message:
        "User unblocked successfully",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "UNBLOCK USER ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to unblock user",
    });
  }
};

export const getBlockedUsersController =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const blockedUsers =
        await getBlockedUsers(
          userId
        );

      return res.status(200).json({
        success: true,
        message:
          "Blocked users fetched successfully",
        data: blockedUsers,
      });
    } catch (error: any) {
      console.error(
        "GET BLOCKED USERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch blocked users",
      });
    }
  };