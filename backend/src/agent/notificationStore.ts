import { db } from "../db";

export async function createInvoiceNotification(invoiceId: string, username: string, description: string, amount: number, currency: string) {
  await db.query(
    `insert into notifications (username, type, invoice_id, title, message)
     values ($1, 'INVOICE_CREATED', $2, $3, $4)`,
    [username.toLowerCase(), invoiceId, "New Cobro invoice", `You received an invoice for ${amount.toLocaleString("en-US")} ${currency}: ${description}`],
  );
}

export async function listNotifications(walletAddress: string) {
  const result = await db.query(
    `select n.* from notifications n
     join users u on lower(u.username) = lower(n.username)
     where lower(u.wallet_address) = lower($1)
     order by n.created_at desc limit 50`, [walletAddress]);
  return result.rows;
}
