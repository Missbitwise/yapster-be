import bcrypt from "bcrypt";
import { RegisterUserDTO } from "./user.dto.js";
import { createUser, findUserById } from "./user.repository.js";
import jwt from "jsonwebtoken";
import { LoginDTO } from "./user.dto.js";
import { findUserByEmail } from "./user.repository.js";

export const registerUser = async (userData: RegisterUserDTO) => {
  const { name, username, email, password } = userData;

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await createUser({
    name,
    username,
    email,
    passwordHash,
  });

  return user;
};

export const loginUser = async (data: LoginDTO) => {
  const user = await findUserByEmail(data.email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(
    data.password,
    user.password_hash
  );

  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(
    {
      userId: user.id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      profile_picture: user.profile_picture,
      bio: user.bio,
    },
    token,
  };
};

export const getUserById = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};