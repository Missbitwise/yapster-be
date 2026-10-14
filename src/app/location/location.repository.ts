import { pool } from "../../db/postgres.js";

export const findUserLocation = async (userId: string) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      latitude,
      longitude,
      locality,
      created_at,
      updated_at
    FROM locations
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

export const upsertLocation = async (
  userId: string,
  data: {
    latitude: number;
    longitude: number;
    locality?: string;
  }
) => {
  const result = await pool.query(
    `
    INSERT INTO locations (
      user_id,
      latitude,
      longitude,
      locality
    )
    VALUES ($1, $2, $3, $4)

    ON CONFLICT (user_id)
    DO UPDATE SET
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      locality = EXCLUDED.locality,
      updated_at = CURRENT_TIMESTAMP

    RETURNING
      id,
      user_id,
      latitude,
      longitude,
      locality,
      created_at,
      updated_at
    `,
    [
      userId,
      data.latitude,
      data.longitude,
      data.locality ?? null,
    ]
  );

  return result.rows[0];
};

export const findNearbyUsers = async (
  userId: string,
  radiusKm: number
) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.username,
      u.profile_picture,
      u.bio,
      l.locality,

      ROUND(
        (
          earth_distance(
            ll_to_earth(my_location.latitude, my_location.longitude),
            ll_to_earth(l.latitude, l.longitude)
          ) / 1000
        )::numeric,
        2
      ) AS distance_km

    FROM locations l

    INNER JOIN users u
      ON u.id = l.user_id

    CROSS JOIN locations my_location

    WHERE my_location.user_id = $1
      AND l.user_id <> $1
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users bu
        WHERE (bu.blocker_id = $1 AND bu.blocked_id = l.user_id)
           OR (bu.blocker_id = l.user_id AND bu.blocked_id = $1)
      )

      AND earth_distance(
        ll_to_earth(my_location.latitude, my_location.longitude),
        ll_to_earth(l.latitude, l.longitude)
      ) <= ($2 * 1000)

    ORDER BY distance_km ASC
    `,
    [userId, radiusKm]
  );

  return result.rows;
};

export const findEveryoneUsers = async (
  userId: string,
  limit: number,
  offset: number
) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.username,
      u.profile_picture,
      u.bio,
      l.locality,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM friends f
          WHERE f.user_id = $1 AND f.friend_id = u.id
        ) THEN 'friend'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests fr
          WHERE fr.sender_id = $1
            AND fr.receiver_id = u.id
            AND fr.status = 'pending'
        ) THEN 'request_sent'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests fr
          WHERE fr.sender_id = u.id
            AND fr.receiver_id = $1
            AND fr.status = 'pending'
        ) THEN 'request_received'
        ELSE NULL
      END AS relationship_status
    FROM users u
    LEFT JOIN locations l ON l.user_id = u.id
    WHERE u.id <> $1
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users bu
        WHERE (bu.blocker_id = $1 AND bu.blocked_id = u.id)
           OR (bu.blocker_id = u.id AND bu.blocked_id = $1)
      )
    ORDER BY u.created_at DESC, u.id
    LIMIT $2
    OFFSET $3
    `,
    [userId, limit, offset]
  );

  return result.rows;
};
