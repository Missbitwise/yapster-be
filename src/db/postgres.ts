import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});

const connectPostgres = async () => {
  try {
    const client = await pool.connect();
    console.log(" PostgreSQL (Supabase) connected successfully");
    client.release();
  } catch (error) {
    console.error("❌ POSTGRESQL CONNECTION FAILED:", error);
    process.exit(1);
  }
};

export { pool };
export default connectPostgres;
