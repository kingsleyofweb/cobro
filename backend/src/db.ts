import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the Cobro backend");

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" || process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
