import dotenv from "dotenv";
import http from "http";

import app from "./app.js";
import connectPostgres from "./db/postgres.js";
import connectMongoDB from "./db/mongodb.js";
import { initializeWebSocket } from "./websocket/websocket.server.js";

dotenv.config();

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongoDB();

    const server = http.createServer(app);

    initializeWebSocket(server);

    server.listen(PORT, () => {
      console.log(
        `🚀 Express server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "❌ Failed to start server:",
      error
    );

    process.exit(1);
  }
};

startServer();