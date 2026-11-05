import { db } from "../db";

export interface Invoice {
  id: string;
  freelancerUsername: string;
  freelancerAddress: string;
  clientUsername: string;
  description: string;
  currency: "cNGN" | "USDC" | "wARS" | "wBRL";
  acceptedSettlementCurrencies?: ("cNGN" | "USDC")[];
  amount: number;
  amountFormatted: string;
  amountUnits: string;
  dueDate: string;
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith: string | null;
  createdAt: string;
}

function mapInvoice(row: any): Invoice {
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

export async function createInvoice(data: Omit<Invoice, "id" | "status" | "txHash" | "paidWith" | "createdAt" | "amountFormatted" | "amountUnits">): Promise<Invoice> {
  const id = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.query(
    `insert into invoices (id, freelancer_username, freelancer_address, client_username, description, currency, accepted_settlement_currencies, amount, amount_units, due_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [id, data.freelancerUsername, data.freelancerAddress, data.clientUsername, data.description, data.currency, data.acceptedSettlementCurrencies, data.amount, (data.amount * 1_000_000).toString(), data.dueDate],
  );
  return mapInvoice(result.rows[0]);
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const result = await db.query("select * from invoices where id = $1", [id]);
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}

export async function listInvoices(walletAddress?: string): Promise<Invoice[]> {
  const result = walletAddress
    ? await db.query(`select i.* from invoices i left join users u on lower(u.username) = lower(i.client_username)
      where lower(i.freelancer_address) = lower($1) or lower(u.wallet_address) = lower($1) order by i.created_at desc`, [walletAddress])
    : await db.query("select * from invoices order by created_at desc");
  return result.rows.map(mapInvoice);
}

export async function markPaid(id: string, txHash: string, paidWith: string): Promise<Invoice | undefined> {
  const result = await db.query("update invoices set status = 'PAID', tx_hash = $2, paid_with = $3 where id = $1 returning *", [id, txHash, paidWith]);
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}
