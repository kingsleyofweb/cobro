"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
require("dotenv/config");
const pg_1 = require("pg");
if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for the Cobro backend");
exports.db = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" || process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false } : undefined,
    max: 10,
});
