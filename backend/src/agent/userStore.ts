import { db } from "../db";

export async function upsertUser(username: string, walletAddress: string, role: "client" | "freelancer") {
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  const result = await db.query(
    `insert into users (username, wallet_address, role) values ($1,$2,$3)
     on conflict (username) do update set wallet_address = excluded.wallet_address, role = excluded.role
     returning username, wallet_address, role`,
    [normalized, walletAddress, role],
  );
  return result.rows[0];
}

export async function findUser(username: string) {
  const result = await db.query("select username, wallet_address, role from users where lower(username) = lower($1)", [username.trim().replace(/^@/, "")]);
  return result.rows[0];
}
