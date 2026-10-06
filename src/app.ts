import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import userRoutes from "./app/user/user.routes.js";
import locationRoutes from "./app/location/location.routes.js";
import friendRoutes from "./app/friend/friend.routes.js";
import messageRoutes from "./app/message/message.routes.js";

dotenv.config();

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Backend is running 🚀",
  });
});

app.use("/api/users", userRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/messages", messageRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;
