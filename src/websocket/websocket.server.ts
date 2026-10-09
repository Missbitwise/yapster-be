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
  getUnreadMessageCount,
  markConversationAsReadService,
  getUnreadCountsGroupedBySenderService,
} from "../app/message/message.service.js";

import {
  findFriendIdsByUserId,
  findFriendsByUserId,
  findBlockedUser,
  findBlockedUsersByUserId,
} from "../app/friend/friend.repository.js";

import { markMessagesAsDeliveredForReceiver } from "../app/message/message.repository.js";

import { updateLastSeen } from "../app/user/user.repository.js";

import { generateConversationId } from "../common/utils/conversation.js";

interface JwtPayload {
  userId: string;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();

const isUserOnline = (userId: string): boolean => {
  const userSockets = clients.get(userId);
  if (!userSockets) return false;

  for (const s of Array.from(userSockets)) {
    if (s.readyState === WebSocket.OPEN) {
      return true;
    } else {
      userSockets.delete(s);
    }
  }

  if (userSockets.size === 0) {
    clients.delete(userId);
    return false;
  }

  return false;
};

const addClient = (
  userId: string,
  socket: AuthenticatedSocket
) => {
  const userSockets =
    clients.get(userId) ||
    new Set<AuthenticatedSocket>();

  userSockets.add(socket);
  clients.set(userId, userSockets);
};

const removeClient = (
  userId: string,
  socket: AuthenticatedSocket
): boolean => {
  const userSockets = clients.get(userId);

  if (!userSockets) {
    clients.delete(userId);
    return true;
  }

  userSockets.delete(socket);

  // Clean up any sockets that are closed or closing
  for (const s of Array.from(userSockets)) {
    if (s.readyState !== WebSocket.OPEN) {
      userSockets.delete(s);
    }
  }

  if (userSockets.size === 0) {
    clients.delete(userId);
    return true;
  }

  return false;
};

const getUserSockets = (userId: string): Set<AuthenticatedSocket> => {
  const userSockets = clients.get(userId);
  if (!userSockets) return new Set<AuthenticatedSocket>();

  for (const s of Array.from(userSockets)) {
    if (s.readyState !== WebSocket.OPEN) {
      userSockets.delete(s);
    }
  }

  if (userSockets.size === 0) {
    clients.delete(userId);
    return new Set<AuthenticatedSocket>();
  }

  return userSockets;
};

const notifyFriends = async (
  userId: string,
  status: "online" | "offline",
  lastSeen?: string | Date | null
) => {
  const friendIds = await findFriendIdsByUserId(userId);
  const blockedUsers = await findBlockedUsersByUserId(userId);
  const blockedSet = new Set(blockedUsers.map((b: any) => String(b.id)));

  for (const friendId of friendIds) {
    // If the user has blocked this friend, NEVER broadcast presence to them
    if (blockedSet.has(String(friendId))) {
      continue;
    }

    const friendSockets = getUserSockets(friendId);

    for (const friendSocket of friendSockets) {
      if (friendSocket.readyState === WebSocket.OPEN) {
        friendSocket.send(
          JSON.stringify({
            type: "presence",
            userId,
            status,
            lastSeen: lastSeen
              ? new Date(lastSeen).toISOString()
              : null,
            isBlockedBy: false,
          })
        );
      }
    }
  }
};

export const notifyBlockStatusChange = async (
  blockerId: string,
  blockedId: string,
  isBlocked: boolean
) => {
  const blockedSockets = getUserSockets(blockedId);
  if (blockedSockets.size === 0) return;

  if (isBlocked) {
    // Blocker blocked them: report blocker as offline with no lastSeen
    for (const socket of blockedSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "presence",
            userId: blockerId,
            status: "offline",
            lastSeen: null,
            isBlockedBy: true,
          })
        );
      }
    }
  } else {
    // Blocker unblocked them: report blocker's real presence
    const online = isUserOnline(blockerId);
    for (const socket of blockedSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "presence",
            userId: blockerId,
            status: online ? "online" : "offline",
            lastSeen: null,
            isBlockedBy: false,
          })
        );
      }
    }
  }
};

export const sendUnreadCountToUser = async (userId: string) => {
  const userSockets = getUserSockets(userId);
  if (userSockets.size === 0) return;

  const unreadBySender = await getUnreadCountsGroupedBySenderService(userId);
  const unreadCount = await getUnreadMessageCount(userId);

  const payload = JSON.stringify({
    type: "unread_count",
    data: {
      totalUnread: unreadCount,
      unreadBySender,
      unreadSendersCount: Object.keys(unreadBySender).length,
    },
  });

  for (const s of userSockets) {
    if (s.readyState === WebSocket.OPEN) {
      s.send(payload);
    }
  }
};

export const initializeWebSocket = (server: Server) => {
  const wss = new WebSocketServer({
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

        const token = url.searchParams.get("token");

        if (!token) {
          socket.close(
            1008,
            "Authentication required"
          );
          return;
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
          throw new Error(
            "JWT_SECRET is not defined"
          );
        }

        const decoded = jwt.verify(
          token,
          secret
        ) as JwtPayload;

        socket.userId = decoded.userId;
        socket.isAlive = true;
        socket.on("pong", () => {
          socket.isAlive = true;
        });

        const wasOffline =
          !isUserOnline(decoded.userId);

        addClient(
          decoded.userId,
          socket
        );

        console.log(
          `🟢 WebSocket user connected: ${decoded.userId}`
        );

        if (wasOffline) {
          await notifyFriends(
            decoded.userId,
            "online"
          );
        }

        socket.send(
          JSON.stringify({
            type: "connection",
            message:
              "WebSocket connected successfully",
          })
        );

        // Send current presence of all friends to the connecting user
        const friends = await findFriendsByUserId(decoded.userId);
        for (const friend of friends) {
          // If friend has blocked connecting user, friend appears offline with no lastSeen
          const friendBlockedMe = await findBlockedUser(
            friend.id,
            decoded.userId
          );

          if (friendBlockedMe) {
            socket.send(
              JSON.stringify({
                type: "presence",
                userId: friend.id,
                status: "offline",
                lastSeen: null,
                isBlockedBy: true,
              })
            );
          } else {
            const isFriendOnline = isUserOnline(friend.id);
            socket.send(
              JSON.stringify({
                type: "presence",
                userId: friend.id,
                status: isFriendOnline ? "online" : "offline",
                lastSeen: friend.last_seen
                  ? new Date(friend.last_seen).toISOString()
                  : null,
                isBlockedBy: false,
              })
            );
          }
        }

        // Deliver any pending "sent" messages to this user and notify senders (excluding senders blocked by this receiver)
        const myBlockedUsers = await findBlockedUsersByUserId(decoded.userId);
        const myBlockedIds = myBlockedUsers.map((b: any) => String(b.id));
        const newlyDelivered =
          await markMessagesAsDeliveredForReceiver(
            decoded.userId,
            myBlockedIds
          );
        for (const delMsg of newlyDelivered) {
          const senderSockets = getUserSockets(delMsg.senderId);
          for (const senderSocket of senderSockets) {
            if (senderSocket.readyState === WebSocket.OPEN) {
              senderSocket.send(
                JSON.stringify({
                  type: "message",
                  data: delMsg,
                })
              );
            }
          }
        }

        await sendUnreadCountToUser(decoded.userId);

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
                const { receiverId } =
                  message;

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

                // If receiver has blocked sender, do not forward typing event
                const receiverBlockedSender = await findBlockedUser(
                  receiverId,
                  senderId
                );

                if (receiverBlockedSender) {
                  return;
                }

                const receiverSockets =
                  getUserSockets(
                    receiverId
                  );

                for (
                  const receiverSocket of receiverSockets
                ) {
                  if (
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
                }

                return;
              }

              if (
                message.type ===
                "stopped_typing"
              ) {
                const { receiverId } =
                  message;

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

                // If receiver has blocked sender, do not forward stopped_typing event
                const receiverBlockedSender = await findBlockedUser(
                  receiverId,
                  senderId
                );

                if (receiverBlockedSender) {
                  return;
                }

                const receiverSockets =
                  getUserSockets(
                    receiverId
                  );

                for (
                  const receiverSocket of receiverSockets
                ) {
                  if (
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

                // Check if receiver has blocked sender
                const receiverBlockedSender = await findBlockedUser(
                  receiverId,
                  senderId
                );

                let messageToSend =
                  savedMessage.toObject ? savedMessage.toObject() : savedMessage;

                // Only deliver to receiver if receiver has NOT blocked sender
                if (!receiverBlockedSender) {
                  const receiverSockets =
                    getUserSockets(
                      receiverId
                    );

                  const receiverIsOnline =
                    receiverSockets.size >
                    0;

                  if (receiverIsOnline) {
                    const deliveredMessage =
                      await updateStatus(
                        savedMessage._id.toString(),
                        receiverId,
                        "delivered"
                      );

                    if (deliveredMessage) {
                      messageToSend =
                        deliveredMessage;
                    }

                    for (
                      const receiverSocket of receiverSockets
                    ) {
                      if (
                        receiverSocket.readyState ===
                        WebSocket.OPEN
                      ) {
                        receiverSocket.send(
                          JSON.stringify({
                            type:
                              "message",
                            data:
                              messageToSend,
                          })
                        );
                      }
                    }

                    await sendUnreadCountToUser(receiverId);
                  }
                }

                // Echo back to all of sender's sockets
                const senderSockets = getUserSockets(senderId);
                for (const senderSocket of senderSockets) {
                  if (senderSocket.readyState === WebSocket.OPEN) {
                    senderSocket.send(
                      JSON.stringify({
                        type: "message",
                        data:
                          messageToSend,
                      })
                    );
                  }
                }

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

                const messageReadEvent =
                  JSON.stringify({
                    type:
                      "message_read",
                    data:
                      updatedMessage,
                  });

                socket.send(
                  messageReadEvent
                );

                const originalSenderSockets =
                  getUserSockets(
                    existingMessage.senderId
                  );

                for (
                  const originalSenderSocket of originalSenderSockets
                ) {
                  if (
                    originalSenderSocket.readyState ===
                    WebSocket.OPEN
                  ) {
                    originalSenderSocket.send(
                      messageReadEvent
                    );
                  }
                }

                // Send updated unread count to current user
                await sendUnreadCountToUser(senderId);

                return;
              }

              if (message.type === "read_conversation") {
                const { contactId } = message;
                if (!contactId) return;

                const conversationId = generateConversationId(
                  senderId,
                  contactId
                );

                const readMessages = await markConversationAsReadService(
                  conversationId,
                  senderId
                );

                if (readMessages.length > 0) {
                  const originalSenderSockets = getUserSockets(contactId);
                  for (const readMsg of readMessages) {
                    const readEvent = JSON.stringify({
                      type: "message_read",
                      data: readMsg,
                    });
                    for (const s of originalSenderSockets) {
                      if (s.readyState === WebSocket.OPEN) {
                        s.send(readEvent);
                      }
                    }
                  }
                }

                await sendUnreadCountToUser(senderId);

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

                const editEvent =
                  JSON.stringify({
                    type:
                      "message_edited",
                    data:
                      updatedMessage,
                  });

                socket.send(
                  editEvent
                );

                const receiverSockets =
                  getUserSockets(
                    updatedMessage.receiverId
                  );

                for (
                  const receiverSocket of receiverSockets
                ) {
                  if (
                    receiverSocket.readyState ===
                    WebSocket.OPEN
                  ) {
                    receiverSocket.send(
                      editEvent
                    );
                  }
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

                const receiverSockets =
                  getUserSockets(
                    deletedMessage.receiverId
                  );

                for (
                  const receiverSocket of receiverSockets
                ) {
                  if (
                    receiverSocket.readyState ===
                    WebSocket.OPEN
                  ) {
                    receiverSocket.send(
                      deletionEvent
                    );
                  }
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
            if (!socket.userId) {
              return;
            }

            const isFullyOffline =
              removeClient(
                socket.userId,
                socket
              );

            if (isFullyOffline) {
              const updatedUser =
                await updateLastSeen(
                  socket.userId
                );

              const lastSeenIso =
                updatedUser?.last_seen
                  ? new Date(
                      updatedUser.last_seen
                    ).toISOString()
                  : new Date().toISOString();

              await notifyFriends(
                socket.userId,
                "offline",
                lastSeenIso
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

export const broadcastWebSocketMessage = async (savedMessage: any) => {
  const msgObj =
    typeof savedMessage.toObject === "function"
      ? savedMessage.toObject()
      : savedMessage;

  const senderId = String(msgObj.senderId);
  const receiverId = String(msgObj.receiverId);

  const receiverBlockedSender = await findBlockedUser(receiverId, senderId);
  let messageToSend = { ...msgObj };

  if (!receiverBlockedSender) {
    const receiverSockets = getUserSockets(receiverId);
    const receiverIsOnline = receiverSockets.size > 0;

    if (receiverIsOnline) {
      const deliveredMessage = await updateStatus(
        String(msgObj._id),
        receiverId,
        "delivered"
      );
      if (deliveredMessage) {
        messageToSend = deliveredMessage;
      }

      for (const receiverSocket of receiverSockets) {
        if (receiverSocket.readyState === WebSocket.OPEN) {
          receiverSocket.send(
            JSON.stringify({
              type: "message",
              data: messageToSend,
            })
          );
        }
      }

      await sendUnreadCountToUser(receiverId);
    }
  }

  const senderSockets = getUserSockets(senderId);
  for (const senderSocket of senderSockets) {
    if (senderSocket.readyState === WebSocket.OPEN) {
      senderSocket.send(
        JSON.stringify({
          type: "message",
          data: messageToSend,
        })
      );
    }
  }
};