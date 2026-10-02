import { pool } from "../../db/postgres.js";

export const findUserById = async (userId: string) => {
  const result = await pool.query(
    `
    SELECT id
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

export const findPendingFriendRequest = async (
  senderId: string,
  receiverId: string
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM friend_requests
    WHERE sender_id = $1
      AND receiver_id = $2
      AND status = 'pending'
    LIMIT 1
    `,
    [senderId, receiverId]
  );

  return result.rows[0] || null;
};

export const createFriendRequest = async (
  senderId: string,
  receiverId: string
) => {
  const result = await pool.query(
    `
    INSERT INTO friend_requests (
      sender_id,
      receiver_id,
      status
    )
    VALUES ($1, $2, 'pending')
    RETURNING
      id,
      sender_id,
      receiver_id,
      status,
      created_at,
      updated_at
    `,
    [senderId, receiverId]
  );

  return result.rows[0];
};

export const findPendingReceivedRequests = async (
  userId: string
) => {
  const result = await pool.query(
    `
    SELECT
      fr.id,
      fr.sender_id,
      u.name,
      u.username,
      u.profile_picture,
      u.bio,
      fr.status,
      fr.created_at
    FROM friend_requests fr
    INNER JOIN users u
      ON u.id = fr.sender_id
    WHERE fr.receiver_id = $1
      AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

export const findFriendRequestById = async (
  requestId: string
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM friend_requests
    WHERE id = $1
    LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
};

export const updateFriendRequestStatus = async (
  requestId: string,
  status: "accepted" | "rejected"
) => {
  const result = await pool.query(
    `
    UPDATE friend_requests
    SET
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
    `,
    [status, requestId]
  );

  return result.rows[0];
};


export const acceptFriendRequest = async (
  requestId: string,
  receiverId: string
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
      SELECT *
      FROM friend_requests
      WHERE id = $1
        AND receiver_id = $2
        AND status = 'pending'
      FOR UPDATE
      `,
      [requestId, receiverId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      throw new Error(
        "Friend request not found or already processed"
      );
    }

    const updateResult = await client.query(
      `
      UPDATE friend_requests
      SET
        status = 'accepted',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [requestId]
    );

    const friendship1Result = await client.query(
      `
      INSERT INTO friends (
        user_id,
        friend_id
      )
      VALUES ($1, $2)
      RETURNING *
      `,
      [request.receiver_id, request.sender_id]
    );

    const friendship2Result = await client.query(
      `
      INSERT INTO friends (
        user_id,
        friend_id
      )
      VALUES ($1, $2)
      RETURNING *
      `,
      [request.sender_id, request.receiver_id]
    );

    await client.query("COMMIT");

    return {
      request: updateResult.rows[0],
      friendships: [
        friendship1Result.rows[0],
        friendship2Result.rows[0],
      ],
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

export const findFriendsByUserId = async (
  userId: string
) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.username,
      u.profile_picture,
      u.bio,
      f.created_at AS friends_since
    FROM friends f
    INNER JOIN users u
      ON u.id = f.friend_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

export const findBlockedUser = async (
  blockerId: string,
  blockedId: string
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM blocked_users
    WHERE blocker_id = $1
      AND blocked_id = $2
    LIMIT 1
    `,
    [blockerId, blockedId]
  );

  return result.rows[0] || null;
};

export const blockUser = async (
  blockerId: string,
  blockedId: string
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const blockResult = await client.query(
      `
      INSERT INTO blocked_users (
        blocker_id,
        blocked_id
      )
      VALUES ($1, $2)
      RETURNING *
      `,
      [blockerId, blockedId]
    );

    await client.query(
      `
      DELETE FROM friends
      WHERE user_id = $1
        AND friend_id = $2
      `,
      [blockerId, blockedId]
    );

    await client.query(
      `
      DELETE FROM friends
      WHERE user_id = $1
        AND friend_id = $2
      `,
      [blockedId, blockerId]
    );

    await client.query("COMMIT");

    return blockResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const findAnyBlockBetweenUsers = async (
  userId: string,
  otherUserId: string
) => {
  const result = await pool.query(
    `
    SELECT *
    FROM blocked_users
    WHERE
      (blocker_id = $1 AND blocked_id = $2)
      OR
      (blocker_id = $2 AND blocked_id = $1)
    LIMIT 1
    `,
    [userId, otherUserId]
  );

  return result.rows[0] || null;
};

export const deleteBlockedUser = async (
  blockerId: string,
  blockedId: string
) => {
  const result = await pool.query(
    `
    DELETE FROM blocked_users
    WHERE blocker_id = $1
      AND blocked_id = $2
    RETURNING *
    `,
    [blockerId, blockedId]
  );

  return result.rows[0] || null;
};

export const findBlockedUsersByUserId = async (
  userId: string
) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.username,
      u.profile_picture,
      u.bio,
      bu.created_at AS blocked_at
    FROM blocked_users bu
    INNER JOIN users u
      ON u.id = bu.blocked_id
    WHERE bu.blocker_id = $1
    ORDER BY bu.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

export const areUsersFriends = async (
  userId: string,
  friendId: string
) => {
  const result = await pool.query(
    `
    SELECT 1
    FROM friends
    WHERE user_id = $1
      AND friend_id = $2
    LIMIT 1
    `,
    [userId, friendId]
  );

  return result.rows.length > 0;
};

export const findFriendIdsByUserId = async (
  userId: string
) => {
  const result = await pool.query(
    `
    SELECT friend_id
    FROM friends
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows.map(
    (row) => row.friend_id
  );
};