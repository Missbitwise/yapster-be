import Message from "../../models/message.model.js";

export const createMessage = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string
) => {
  const message = await Message.create({
    conversationId,
    senderId,
    receiverId,
    content,
    status: "sent",
  });

  return message;
};

export const findMessagesByConversationId = async (
  conversationId: string,
  userId: string,
  limit: number = 50,
  cursor?: string
) => {
  const query: any = {
    conversationId,
    deletedFor: {
      $ne: userId,
    },
  };

  if (cursor) {
    query._id = {
      $lt: cursor,
    };
  }

  const messages = await Message.find(query)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit + 1)
    .lean();

  const hasMore = messages.length > limit;

  const paginatedMessages = hasMore
    ? messages.slice(0, limit)
    : messages;

  const nextCursor = hasMore
    ? paginatedMessages[
        paginatedMessages.length - 1
      ]._id.toString()
    : null;

  return {
    messages: paginatedMessages.reverse(),
    nextCursor,
    hasMore,
  };
};

export const findMessageById = async (
  messageId: string
) => {
  return await Message.findById(messageId).lean();
};

export const updateMessageStatus = async (
  messageId: string,
  status: "sent" | "delivered" | "read"
) => {
  const message = await Message.findByIdAndUpdate(
    messageId,
    {
      status,
    },
    {
      new: true,
    }
  ).lean();

  return message;
};

export const editMessage = async (
  messageId: string,
  content: string
) => {
  const message = await Message.findByIdAndUpdate(
    messageId,
    {
      content,
      editedAt: new Date(),
    },
    {
      new: true,
    }
  ).lean();

  return message;
};

export const deleteMessageForMe = async (
  messageId: string,
  userId: string
) => {
  const message = await Message.findByIdAndUpdate(
    messageId,
    {
      $addToSet: {
        deletedFor: userId,
      },
    },
    {
      new: true,
    }
  ).lean();

  return message;
};

export const deleteMessageForEveryone = async (
  messageId: string
) => {
  const message = await Message.findByIdAndDelete(
    messageId
  ).lean();

  return message;
};

export const countUnreadMessagesByUserId = async (
  userId: string
) => {
  return await Message.countDocuments({
    receiverId: userId,
    status: { $ne: "read" },
  });
};