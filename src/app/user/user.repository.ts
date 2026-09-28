import { pool } from "../../db/postgres.js";

export interface CreateUserData {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
}

export const createUser = async (userData: CreateUserData) => {
  const { name, username, email, passwordHash } = userData;

  const query = `
    INSERT INTO users (
      name,
      username,
      email,
      password_hash
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      name,
      username,
      email,
      profile_picture,
      bio,
      created_at,
      updated_at;
  `;

  const values = [
    name,
    username,
    email,
    passwordHash,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};

export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    `
    SELECT *
    FROM users
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
};

export const findUserById = async (userId: string) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      username,
      email,
      profile_picture,
      bio,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
};