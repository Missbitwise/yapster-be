import dotenv from "dotenv";
import app from "./app"
import connectPostgres from "./db/postgres";
import connectMongoDB from "./db/mongodb";


dotenv.config();

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongoDB();

    app.listen(PORT, () => {
      console.log(`🚀 Express server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
