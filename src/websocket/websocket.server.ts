import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, getTrustedFrontendOrigins } from "../common/utils/auth-cookie.js";

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
  findAnyBlockBetweenUsers,
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
  console.info("[presence:broadcast] evaluating recipients", {
    userId,
    status,
    friendCount: friendIds.length,
    blockedFriendIds: Array.from(blockedSet),
  });

  for (const friendId of friendIds) {
    const blockedEitherWay = blockedSet.has(String(friendId)) ||
      Boolean(await findBlockedUser(String(friendId), userId));

    if (blockedEitherWay) {
      const friendSockets = getUserSockets(String(friendId));
      console.info("[presence:broadcast] hiding presence from blocked pair", {
        userId,
        recipientId: friendId,
      });
      for (const friendSocket of friendSockets) {
        if (friendSocket.readyState === WebSocket.OPEN) {
          friendSocket.send(JSON.stringify({
            type: "presence",
            userId,
            status: "offline",
            lastSeen: null,
            isHidden: true,
          }));
        }
      }
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
            isHidden: false,
          })
        );
        console.info("[presence:broadcast] event sent", {
          userId,
          recipientId: friendId,
          status,
        });
      }
    }
  }
};

export const notifyBlockStatusChange = async (
  blockerId: string,
  blockedId: string,
  isBlocked: boolean
) => {
  console.info("[presence:block-change] notifying blocked user", {
    blockerId,
    blockedId,
    isBlocked,
    connectedSockets: getUserSockets(blockedId).size,
  });
  const blockedSockets = getUserSockets(blockedId);
  const blockerSockets = getUserSockets(blockerId);
  const sendPairState = (
    sockets: Set<AuthenticatedSocket>,
    userId: string,
    hidden: boolean
  ) => {
    const status = hidden
      ? "offline"
      : isUserOnline(userId) ? "online" : "offline";
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "presence",
          userId,
          status,
          lastSeen: null,
          isHidden: hidden,
          isBlockedBy: hidden,
        }));
      }
    }
  };

  sendPairState(blockedSockets, blockerId, isBlocked);
  sendPairState(blockerSockets, blockedId, isBlocked);
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

export const notifyMessagesRead = (messages: any[]) => {
  for (const message of messages) {
    const payload = JSON.stringify({
      type: "message_read",
      data: message,
    });
    const senderSockets = getUserSockets(String(message.senderId));
    for (const socket of senderSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
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
        const origin = request.headers.origin;
        if (!origin || !getTrustedFrontendOrigins().includes(origin)) {
          socket.close(1008, "Origin not allowed");
          return;
        }

        const cookieHeader = request.headers.cookie || "";
        const token = cookieHeader
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
          ?.slice(AUTH_COOKIE_NAME.length + 1);

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

        const friends = await findFriendsByUserId(decoded.userId);
        console.info("[presence:initial] checking friend visibility", {
          userId: decoded.userId,
          friendCount: friends.length,
        });
        for (const friend of friends) {
          const blockBetweenUsers = await findAnyBlockBetweenUsers(
            decoded.userId,
            friend.id
          );

          if (blockBetweenUsers) {
            console.info("[presence:initial] block exists; hiding both users", {
              userId: decoded.userId,
              friendId: friend.id,
            });
            socket.send(
              JSON.stringify({
                type: "presence",
                userId: friend.id,
                status: "offline",
                lastSeen: null,
                isBlockedBy: true,
                isHidden: true,
              })
            );
          } else {
            const isFriendOnline = isUserOnline(friend.id);
            console.info("[presence:initial] sending friend presence", {
              userId: decoded.userId,
              friendId: friend.id,
              statusSent: isFriendOnline ? "online" : "offline",
              lastSeenAvailable: Boolean(friend.last_seen),
            });
            socket.send(
              JSON.stringify({
                type: "presence",
                userId: friend.id,
                status: isFriendOnline ? "online" : "offline",
                lastSeen: friend.last_seen
                  ? new Date(friend.last_seen).toISOString()
                  : null,
                isBlockedBy: false,
                isHidden: false,
              })
            );
          }
        }

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

              console.info("[websocket:incoming] event received", {
                userId: socket.userId,
                type: message?.type ?? null,
                keys: message && typeof message === "object"
                  ? Object.keys(message)
                  : [],
              });

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
                console.info("[message:ws-send] backend save confirmed", {
                  messageId: String(savedMessage._id),
                  senderId,
                  receiverId,
                  status: savedMessage.status,
                  deletedFor: savedMessage.deletedFor,
                });

                const receiverBlockedSender = await findBlockedUser(
                  receiverId,
                  senderId
                );

                let messageToSend =
                  savedMessage.toObject ? savedMessage.toObject() : savedMessage;

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
                  } else {
                    console.info("[message:ws-send] saved; receiver offline", {
                      messageId: String(savedMessage._id),
                      receiverId,
                    });
                  }
                } else {
                  console.info("[message:ws-send] saved but withheld from blocker", {
                    messageId: String(savedMessage._id),
                    senderId,
                    receiverId,
                    deletedFor: savedMessage.deletedFor,
                  });
                }

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
              console.error("[websocket:message-handler] failed", {
                userId: socket.userId,
                error: error instanceof Error ? error.message : String(error),
              });

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
