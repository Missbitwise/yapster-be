import { Router } from "express";
import {
  register,
  login,
  getMe,
  updateMe,
  logout,
} from "./user.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js"

const userRoutes = Router();

userRoutes.post("/register", register);
userRoutes.post("/login", login);
userRoutes.post("/logout", logout);
userRoutes.get("/me", authenticate, getMe);
userRoutes.patch("/me", authenticate, updateMe);

export default userRoutes;
