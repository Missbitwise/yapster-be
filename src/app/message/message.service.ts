import {
  areUsersFriends,
  findAnyBlockBetweenUsers,
 
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

  const existingBlock =
    await findAnyBlockBetweenUsers(
      senderId,
      receiverId
    );

  if (existingBlock) {
    throw new Error(
      "You cannot send messages to a blocked user"
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
  return await countUnreadMessagesByUserId(
    userId
  );
};