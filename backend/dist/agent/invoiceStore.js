"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.getInvoice = getInvoice;
exports.listInvoices = listInvoices;
exports.markPaid = markPaid;
const db_1 = require("../db");
function mapInvoice(row) {
    return {
        id: row.id, freelancerUsername: row.freelancer_username, freelancerAddress: row.freelancer_address,
        clientUsername: row.client_username, description: row.description, currency: row.currency,
        acceptedSettlementCurrencies: row.accepted_settlement_currencies, amount: Number(row.amount),
        amountFormatted: Number(row.amount).toLocaleString("en-US"), amountUnits: row.amount_units,
        dueDate: row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : row.due_date,
        status: row.status, txHash: row.tx_hash, paidWith: row.paid_with,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}
async function createInvoice(data) {
    const id = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const result = await db_1.db.query(`insert into invoices (id, freelancer_username, freelancer_address, client_username, description, currency, accepted_settlement_currencies, amount, amount_units, due_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [id, data.freelancerUsername, data.freelancerAddress, data.clientUsername, data.description, data.currency, data.acceptedSettlementCurrencies, data.amount, (data.amount * 1_000_000).toString(), data.dueDate]);
    return mapInvoice(result.rows[0]);
}
async function getInvoice(id) {
    const result = await db_1.db.query("select * from invoices where id = $1", [id]);
    return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}
async function listInvoices(walletAddress) {
    const result = walletAddress
        ? await db_1.db.query(`select i.* from invoices i left join users u on lower(u.username) = lower(i.client_username)
      where lower(i.freelancer_address) = lower($1) or lower(u.wallet_address) = lower($1) order by i.created_at desc`, [walletAddress])
        : await db_1.db.query("select * from invoices order by created_at desc");
    return result.rows.map(mapInvoice);
}
async function markPaid(id, txHash, paidWith) {
    const result = await db_1.db.query("update invoices set status = 'PAID', tx_hash = $2, paid_with = $3 where id = $1 returning *", [id, txHash, paidWith]);
    return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}
