import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";

import {
  sendMessage,
  updateStatus,
  getMessageById,
  editMessageService,
  deleteMessageForMeService,
  deleteMessageForEveryoneService,
} from "../app/message/message.service.js";

import {
  findFriendIdsByUserId,
} from "../app/friend/friend.repository.js";

import {
  updateLastSeen,
} from "../app/user/user.repository.js";

import { generateConversationId } from "../common/utils/conversation.js";

interface JwtPayload {
  userId: string;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
}

const clients = new Map<string, AuthenticatedSocket>();

const notifyFriends = async (
  userId: string,
  status: "online" | "offline"
) => {
  const friendIds =
    await findFriendIdsByUserId(userId);

  for (const friendId of friendIds) {
    const friendSocket =
      clients.get(friendId);

    if (
      friendSocket &&
      friendSocket.readyState ===
        WebSocket.OPEN
    ) {
      friendSocket.send(
        JSON.stringify({
          type: "presence",
          userId,
          status,
        })
      );
    }
  }
};

export const initializeWebSocket = (
  server: Server
) => {
  const wss =
    new WebSocketServer({
      server,
    });

  wss.on(
    "connection",
    async (
      socket: AuthenticatedSocket,
      request
    ) => {
      try {
        const url = new URL(
          request.url || "",
          "http://localhost"
        );

        const token =
          url.searchParams.get("token");

        if (!token) {
          socket.close(
            1008,
            "Authentication required"
          );
          return;
        }

        const secret =
          process.env.JWT_SECRET;

        if (!secret) {
          throw new Error(
            "JWT_SECRET is not defined"
          );
        }

        const decoded = jwt.verify(
          token,
          secret
        ) as JwtPayload;

        socket.userId =
          decoded.userId;

        clients.set(
          decoded.userId,
          socket
        );

        console.log(
          `🟢 WebSocket user connected: ${decoded.userId}`
        );

        await notifyFriends(
          decoded.userId,
          "online"
        );

        socket.send(
          JSON.stringify({
            type: "connection",
            message:
              "WebSocket connected successfully",
          })
        );

        socket.on(
          "message",
          async (data) => {
            try {
              const message =
                JSON.parse(
                  data.toString()
                );

              const senderId =
                socket.userId;

              if (!senderId) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    message:
                      "Unauthorized",
                  })
                );

                return;
              }

              if (
                message.type ===
                "typing"
              ) {
                const {
                  receiverId,
                } = message;

                if (!receiverId) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "receiverId is required",
                    })
                  );

                  return;
                }

                const receiverSocket =
                  clients.get(
                    receiverId
                  );

                if (
                  receiverSocket &&
                  receiverSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  receiverSocket.send(
                    JSON.stringify({
                      type: "typing",
                      userId:
                        senderId,
                    })
                  );
                }

                return;
              }

              if (
                message.type ===
                "stopped_typing"
              ) {
                const {
                  receiverId,
                } = message;

                if (!receiverId) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "receiverId is required",
                    })
                  );

                  return;
                }

                const receiverSocket =
                  clients.get(
                    receiverId
                  );

                if (
                  receiverSocket &&
                  receiverSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  receiverSocket.send(
                    JSON.stringify({
                      type:
                        "stopped_typing",
                      userId:
                        senderId,
                    })
                  );
                }

                return;
              }

              if (
                message.type ===
                "message"
              ) {
                const {
                  receiverId,
                  content,
                } = message;

                if (
                  !receiverId ||
                  !content
                ) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "receiverId and content are required",
                    })
                  );

                  return;
                }

                const conversationId =
                  generateConversationId(
                    senderId,
                    receiverId
                  );

                const savedMessage =
                  await sendMessage(
                    conversationId,
                    senderId,
                    receiverId,
                    content
                  );

                let messageToSend =
                  savedMessage.toObject();

                const receiverSocket =
                  clients.get(
                    receiverId
                  );

                if (
                  receiverSocket &&
                  receiverSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  const deliveredMessage =
                    await updateStatus(
                      savedMessage._id.toString(),
                      receiverId,
                      "delivered"
                    );

                  if (deliveredMessage) {
                    messageToSend =
                      deliveredMessage.toObject();
                  }

                  receiverSocket.send(
                    JSON.stringify({
                      type: "message",
                      data:
                        messageToSend,
                    })
                  );
                }

                socket.send(
                  JSON.stringify({
                    type: "message",
                    data:
                      messageToSend,
                  })
                );

                return;
              }

              if (
                message.type === "read"
              ) {
                const {
                  messageId,
                } = message;

                if (!messageId) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "messageId is required",
                    })
                  );

                  return;
                }

                const existingMessage =
                  await getMessageById(
                    messageId
                  );

                if (!existingMessage) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "Message not found",
                    })
                  );

                  return;
                }

                if (
                  existingMessage.receiverId !==
                  senderId
                ) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "You can only mark messages sent to you as read",
                    })
                  );

                  return;
                }

                const updatedMessage =
                  await updateStatus(
                    messageId,
                    senderId,
                    "read"
                  );

                socket.send(
                  JSON.stringify({
                    type:
                      "message_read",
                    data:
                      updatedMessage,
                  })
                );

                const originalSenderSocket =
                  clients.get(
                    existingMessage.senderId
                  );

                if (
                  originalSenderSocket &&
                  originalSenderSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  originalSenderSocket.send(
                    JSON.stringify({
                      type:
                        "message_read",
                      data:
                        updatedMessage,
                    })
                  );
                }

                return;
              }

              if (
                message.type ===
                "edit"
              ) {
                const {
                  messageId,
                  content,
                } = message;

                if (
                  !messageId ||
                  !content
                ) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "messageId and content are required",
                    })
                  );

                  return;
                }

                const updatedMessage =
                  await editMessageService(
                    messageId,
                    senderId,
                    content
                  );

                socket.send(
                  JSON.stringify({
                    type:
                      "message_edited",
                    data:
                      updatedMessage,
                  })
                );

                const receiverSocket =
                  clients.get(
                    updatedMessage.receiverId
                  );

                if (
                  receiverSocket &&
                  receiverSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  receiverSocket.send(
                    JSON.stringify({
                      type:
                        "message_edited",
                      data:
                        updatedMessage,
                    })
                  );
                }

                return;
              }

              if (
                message.type ===
                "delete_for_me"
              ) {
                const {
                  messageId,
                } = message;

                if (!messageId) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "messageId is required",
                    })
                  );

                  return;
                }

                const updatedMessage =
                  await deleteMessageForMeService(
                    messageId,
                    senderId
                  );

                socket.send(
                  JSON.stringify({
                    type:
                      "message_deleted_for_me",
                    data: {
                      messageId:
                        updatedMessage._id.toString(),
                    },
                  })
                );

                return;
              }

              if (
                message.type ===
                "delete_for_everyone"
              ) {
                const {
                  messageId,
                } = message;

                if (!messageId) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      message:
                        "messageId is required",
                    })
                  );

                  return;
                }

                const deletedMessage =
                  await deleteMessageForEveryoneService(
                    messageId,
                    senderId
                  );

                const receiverSocket =
                  clients.get(
                    deletedMessage.receiverId
                  );

                const deletionEvent =
                  JSON.stringify({
                    type:
                      "message_deleted_for_everyone",
                    data: {
                      messageId:
                        deletedMessage._id.toString(),
                    },
                  });

                socket.send(
                  deletionEvent
                );

                if (
                  receiverSocket &&
                  receiverSocket.readyState ===
                    WebSocket.OPEN
                ) {
                  receiverSocket.send(
                    deletionEvent
                  );
                }

                return;
              }

              socket.send(
                JSON.stringify({
                  type: "error",
                  message:
                    "Invalid message type",
                })
              );
            } catch (error: any) {
              console.error(
                "WebSocket message error:",
                error
              );

              socket.send(
                JSON.stringify({
                  type: "error",
                  message:
                    error.message ||
                    "Failed to process message",
                })
              );
            }
          }
        );

        socket.on(
          "close",
          async () => {
            if (
              socket.userId &&
              clients.get(
                socket.userId
              ) === socket
            ) {
              clients.delete(
                socket.userId
              );
            }

            if (socket.userId) {
              await updateLastSeen(
                socket.userId
              );

              await notifyFriends(
                socket.userId,
                "offline"
              );
            }

            console.log(
              `🔴 WebSocket user disconnected: ${socket.userId}`
            );
          }
        );

        socket.on(
          "error",
          (error) => {
            console.error(
              "WebSocket error:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "WebSocket authentication failed:",
          error
        );

        socket.close(
          1008,
          "Invalid authentication"
        );
      }
    }
  );

  console.log(
    "⚡ WebSocket server initialized"
  );

  return wss;
};