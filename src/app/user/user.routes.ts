import { Router } from "express";
import {
  register,
  login,
  getMe,
} from "./user.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js"

const userRoutes = Router();

userRoutes.post("/register", register);
userRoutes.post("/login", login);
userRoutes.get("/me", authenticate, getMe);

export default userRoutes;