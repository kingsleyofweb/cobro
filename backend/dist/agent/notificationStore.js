"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceNotification = createInvoiceNotification;
exports.listNotifications = listNotifications;
const db_1 = require("../db");
async function createInvoiceNotification(invoiceId, username, description, amount, currency) {
    await db_1.db.query(`insert into notifications (username, type, invoice_id, title, message)
     values ($1, 'INVOICE_CREATED', $2, $3, $4)`, [username.toLowerCase(), invoiceId, "New Cobro invoice", `You received an invoice for ${amount.toLocaleString("en-US")} ${currency}: ${description}`]);
}
async function listNotifications(walletAddress) {
    const result = await db_1.db.query(`select n.* from notifications n
     join users u on lower(u.username) = lower(n.username)
     where lower(u.wallet_address) = lower($1)
     order by n.created_at desc limit 50`, [walletAddress]);
    return result.rows;
}
