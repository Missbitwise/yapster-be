import {
  areUsersFriends,
  findBlockedUser,
  findBlockedUsersByUserId,
} from "../friend/friend.repository.js";

import {
  createMessage,
  findMessagesByConversationId,
  updateMessageStatus,
  findMessageById,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  countUnreadMessagesByUserId,
  markConversationMessagesAsRead,
  getUnreadCountsGroupedBySender,
} from "./message.repository.js";

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string
) => {
  if (!content.trim()) {
    throw new Error(
      "Message content cannot be empty"
    );
  }

  if (senderId === receiverId) {
    throw new Error(
      "You cannot send a message to yourself"
    );
  }

  const areFriends = await areUsersFriends(
    senderId,
    receiverId
  );

  if (!areFriends) {
    throw new Error(
      "You can only send messages to your friends"
    );
  }

  // Check if sender has blocked receiver
  const senderBlockedReceiver = await findBlockedUser(
    senderId,
    receiverId
  );

  if (senderBlockedReceiver) {
    throw new Error(
      "You have blocked this user. Unblock them to send a message."
    );
  }

  // Check if receiver has blocked sender
  const receiverBlockedSender = await findBlockedUser(
    receiverId,
    senderId
  );

  if (receiverBlockedSender) {
    // WhatsApp behavior: Blocked sender CAN send messages.
    // Message is saved with status 'sent', but deletedFor receiver so receiver never receives or sees it.
    // Message stays permanently at 'sent' (single tick) for sender.
    return await createMessage(
      conversationId,
      senderId,
      receiverId,
      content.trim(),
      [receiverId]
    );
  }

  return await createMessage(
    conversationId,
    senderId,
    receiverId,
    content.trim()
  );
};

export const getConversationMessages = async (
  conversationId: string,
  userId: string,
  limit?: number,
  cursor?: string
) => {
  return await findMessagesByConversationId(
    conversationId,
    userId,
    limit,
    cursor
  );
};

export const getMessageById = async (
  messageId: string
) => {
  return await findMessageById(messageId);
};

export const updateStatus = async (
  messageId: string,
  userId: string,
  status:
    | "sent"
    | "delivered"
    | "read"
) => {
  const message =
    await findMessageById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (
    status === "read" &&
    message.receiverId !== userId
  ) {
    throw new Error(
      "You can only mark messages sent to you as read"
    );
  }

  if (
    status === "delivered" &&
    message.receiverId !== userId
  ) {
    throw new Error(
      "You can only mark messages sent to you as delivered"
    );
  }

  const updatedMessage =
    await updateMessageStatus(
      messageId,
      status
    );

  if (!updatedMessage) {
    throw new Error("Message not found");
  }

  return updatedMessage;
};

export const editMessageService = async (
  messageId: string,
  userId: string,
  content: string
) => {
  if (!content.trim()) {
    throw new Error(
      "Message content cannot be empty"
    );
  }

  const message =
    await findMessageById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.senderId !== userId) {
    throw new Error(
      "Only the sender can edit this message"
    );
  }

  const elapsedTime =
    Date.now() - message.createdAt.getTime();

  const fiveMinutes =
    5 * 60 * 1000;

  if (elapsedTime > fiveMinutes) {
    throw new Error(
      "Message can only be edited within 5 minutes"
    );
  }

  const updatedMessage =
    await editMessage(
      messageId,
      content.trim()
    );

  if (!updatedMessage) {
    throw new Error("Message not found");
  }

  return updatedMessage;
};

export const deleteMessageForMeService =
  async (
    messageId: string,
    userId: string
  ) => {
    const message =
      await findMessageById(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    if (
      message.senderId !== userId &&
      message.receiverId !== userId
    ) {
      throw new Error(
        "You are not part of this conversation"
      );
    }

    if (
      message.deletedFor.includes(userId)
    ) {
      throw new Error(
        "Message is already deleted for you"
      );
    }

    const updatedMessage =
      await deleteMessageForMe(
        messageId,
        userId
      );

    if (!updatedMessage) {
      throw new Error("Message not found");
    }

    return updatedMessage;
  };

export const deleteMessageForEveryoneService =
  async (
    messageId: string,
    userId: string
  ) => {
    const message =
      await findMessageById(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId !== userId) {
      throw new Error(
        "Only the sender can delete this message for everyone"
      );
    }

    const deletedMessage =
      await deleteMessageForEveryone(
        messageId
      );

    if (!deletedMessage) {
      throw new Error("Message not found");
    }

    return deletedMessage;
  };

export const getUnreadMessageCount = async (
  userId: string
) => {
  const blockedUsers = await findBlockedUsersByUserId(userId);
  const blockedIds = blockedUsers.map((b: any) => b.id);
  return await countUnreadMessagesByUserId(
    userId,
    blockedIds
  );
};

export const markConversationAsReadService = async (
  conversationId: string,
  userId: string
) => {
  return await markConversationMessagesAsRead(
    conversationId,
    userId
  );
};

export const getUnreadCountsGroupedBySenderService = async (
  userId: string
) => {
  const blockedUsers = await findBlockedUsersByUserId(userId);
  const blockedIds = blockedUsers.map((b: any) => String(b.id));
  return await getUnreadCountsGroupedBySender(userId, blockedIds);
};