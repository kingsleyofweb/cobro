"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertUser = upsertUser;
exports.findUser = findUser;
const db_1 = require("../db");
async function upsertUser(username, walletAddress, role) {
    const normalized = username.trim().replace(/^@/, "").toLowerCase();
    const result = await db_1.db.query(`insert into users (username, wallet_address, role) values ($1,$2,$3)
     on conflict (username) do update set wallet_address = excluded.wallet_address, role = excluded.role
     returning username, wallet_address, role`, [normalized, walletAddress, role]);
    return result.rows[0];
}
async function findUser(username) {
    const result = await db_1.db.query("select username, wallet_address, role from users where lower(username) = lower($1)", [username.trim().replace(/^@/, "")]);
    return result.rows[0];
}
