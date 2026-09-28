import { pool } from "../../db/postgres.js";

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