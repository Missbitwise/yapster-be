import {
  findUserById,
  findPendingFriendRequest,
  createFriendRequest,
  findPendingReceivedRequests,
  updateFriendRequestStatus,
  findFriendRequestById,
  acceptFriendRequest,
  findFriendsByUserId,
  blockUser as blockUserRepository,
  findBlockedUser,
  findAnyBlockBetweenUsers,
  deleteBlockedUser,
  findBlockedUsersByUserId,
} from "./friend.repository.js";

export const sendFriendRequest = async (
  senderId: string,
  receiverId: string
) => {
  if (senderId === receiverId) {
    throw new Error("You cannot send a friend request to yourself");
  }

  const receiver = await findUserById(receiverId);

  if (!receiver) {
    throw new Error("User not found");
  }

  // Check if either user has blocked the other
  const existingBlock = await findAnyBlockBetweenUsers(
    senderId,
    receiverId
  );

  if (existingBlock) {
    throw new Error(
      "You cannot send a friend request to a blocked user"
    );
  }

  const existingRequest = await findPendingFriendRequest(
    senderId,
    receiverId
  );

  if (existingRequest) {
    throw new Error("Friend request already sent");
  }

  return await createFriendRequest(
    senderId,
    receiverId
  );
};

export const getReceivedFriendRequests = async (
  userId: string
) => {
  return await findPendingReceivedRequests(userId);
};

export const respondToFriendRequest = async (
  userId: string,
  requestId: string,
  action: "accept" | "reject"
) => {
  const request = await findFriendRequestById(requestId);

  if (!request) {
    throw new Error("Friend request not found");
  }

  // Only the receiver can accept/reject the request
  if (request.receiver_id !== userId) {
    throw new Error(
      "You are not allowed to respond to this friend request"
    );
  }

  if (request.status !== "pending") {
    throw new Error(
      "This friend request has already been processed"
    );
  }

  // Reject request
  if (action === "reject") {
    return await updateFriendRequestStatus(
      requestId,
      "rejected"
    );
  }

  // Accept request using PostgreSQL transaction
  return await acceptFriendRequest(
    requestId,
    userId
  );
};

export const getFriends = async (
  userId: string
) => {
  return await findFriendsByUserId(userId);
};

export const blockUser = async (
  blockerId: string,
  blockedId: string
) => {
  if (blockerId === blockedId) {
    throw new Error("You cannot block yourself");
  }

  const user = await findUserById(blockedId);

  if (!user) {
    throw new Error("User not found");
  }

  const existingBlock = await findBlockedUser(
    blockerId,
    blockedId
  );

  if (existingBlock) {
    throw new Error("User is already blocked");
  }

  return await blockUserRepository(
    blockerId,
    blockedId
  );
};

export const unblockUser = async (
  blockerId: string,
  blockedId: string
) => {
  if (blockerId === blockedId) {
    throw new Error("You cannot unblock yourself");
  }

  const existingBlock = await findBlockedUser(
    blockerId,
    blockedId
  );

  if (!existingBlock) {
    throw new Error("User is not blocked");
  }

  return await deleteBlockedUser(
    blockerId,
    blockedId
  );
};

export const getBlockedUsers = async (
  userId: string
) => {
  return await findBlockedUsersByUserId(userId);
};