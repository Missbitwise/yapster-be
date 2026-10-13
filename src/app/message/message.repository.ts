import Message from "../../models/message.model.js";

export const createMessage = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  deletedFor: string[] = []
) => {
  const message = await Message.create({
    conversationId,
    senderId,
    receiverId,
    content,
    status: "sent",
    deletedFor,
  });

  console.info("[message:mongo] insert completed", {
    database: Message.db.name,
    collection: Message.collection.name,
    messageId: String(message._id),
    senderId,
    receiverId,
    deletedFor,
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

  console.info("[message:history] querying MongoDB", {
    database: Message.db.name,
    collection: Message.collection.name,
    conversationId,
    userId,
    limit,
    cursor: cursor ?? null,
    excludedForUser: userId,
  });

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

  console.info("[message:history] MongoDB query complete", {
    conversationId,
    userId,
    count: messages.length,
    ids: messages.map((message: any) => String(message._id)),
  });

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
  userId: string,
  blockedSenderIds: string[] = []
) => {
  const query: any = {
    receiverId: userId,
    status: { $ne: "read" },
    deletedFor: { $ne: userId },
  };

  if (blockedSenderIds.length > 0) {
    query.senderId = { $nin: blockedSenderIds };
  }

  return await Message.countDocuments(query);
};

export const markMessagesAsDeliveredForReceiver = async (
  receiverId: string,
  blockedSenderIds: string[] = []
) => {
  const query: any = {
    receiverId,
    status: "sent",
    deletedFor: { $ne: receiverId },
  };

  if (blockedSenderIds.length > 0) {
    query.senderId = { $nin: blockedSenderIds };
  }

  const sentMessages = await Message.find(query).lean();

  if (sentMessages.length === 0) {
    return [];
  }

  const idsToUpdate = sentMessages.map((msg) => msg._id);

  await Message.updateMany(
    {
      _id: { $in: idsToUpdate },
    },
    {
      $set: { status: "delivered" },
    }
  );

  return sentMessages.map((msg) => ({
    ...msg,
    status: "delivered" as const,
  }));
};

export const markConversationMessagesAsRead = async (
  conversationId: string,
  receiverId: string
) => {
  const unreadMessages = await Message.find({
    conversationId,
    receiverId,
    status: { $ne: "read" },
    deletedFor: { $ne: receiverId },
  }).lean();

  if (unreadMessages.length === 0) {
    return [];
  }

  const ids = unreadMessages.map((m) => m._id);

  await Message.updateMany(
    {
      _id: { $in: ids },
    },
    {
      $set: { status: "read" },
    }
  );

  return unreadMessages.map((msg) => ({
    ...msg,
    status: "read" as const,
  }));
};

export const getUnreadCountsGroupedBySender = async (
  userId: string,
  blockedSenderIds: string[] = []
) => {
  const match: any = {
    receiverId: userId,
    status: { $ne: "read" },
    deletedFor: { $ne: userId },
  };

  if (blockedSenderIds.length > 0) {
    match.senderId = { $nin: blockedSenderIds };
  }

  const result = await Message.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$senderId",
        count: { $sum: 1 },
      },
    },
  ]);

  const map: Record<string, number> = {};
  for (const item of result) {
    map[String(item._id)] = item.count;
  }

  return map;
};
