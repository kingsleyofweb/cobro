/**
 * Invoice persistence layer — stores real invoices as a JSON file in backend/data/.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(__dirname, "../../data");
const INVOICES_FILE = path.join(DATA_DIR, "invoices.json");

export interface Invoice {
  id: string;
  freelancerName: string;
  freelancerAddress: string;
  clientName: string;
  clientAddress: string;
  description: string;
  currency: "cNGN" | "USDC" | "wARS" | "wBRL";
  acceptedSettlementCurrencies?: ("cNGN" | "USDC")[];
  amount: number;          // human-readable (e.g. 500000)
  amountFormatted: string; // comma-formatted (e.g. "500,000")
  amountUnits: string;     // atomic units, 6 decimals (e.g. "500000000000")
  dueDate: string;         // ISO date string
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith: string | null; // e.g. "331.42 USDT"
  createdAt: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readInvoices(): Invoice[] {
  ensureDataDir();
  if (!fs.existsSync(INVOICES_FILE)) {
    writeInvoices([]);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(INVOICES_FILE, "utf-8")) as Invoice[];
  } catch {
    return [];
  }
}

function writeInvoices(invoices: Invoice[]): void {
  ensureDataDir();
  fs.writeFileSync(INVOICES_FILE, JSON.stringify(invoices, null, 2), "utf-8");
}

export function createInvoice(
  data: Omit<Invoice, "id" | "status" | "txHash" | "paidWith" | "createdAt" | "amountFormatted" | "amountUnits">
): Invoice {
  const invoices = readInvoices();
  const idSuffix = String(invoices.length + 90).padStart(3, "0");
  const invoice: Invoice = {
    ...data,
    id: `INV-2026-${idSuffix}`,
    amountFormatted: data.amount.toLocaleString("en-US"),
    amountUnits: (data.amount * 1_000_000).toString(),
    status: "UNPAID",
    txHash: null,
    paidWith: null,
    createdAt: new Date().toISOString(),
  };
  invoices.unshift(invoice);
  writeInvoices(invoices);
  return invoice;
}

export function getInvoice(id: string): Invoice | undefined {
  return readInvoices().find((inv) => inv.id === id);
}

export function listInvoices(): Invoice[] {
  return readInvoices();
}

export function markPaid(id: string, txHash: string, paidWith: string): Invoice | undefined {
  const invoices = readInvoices();
  const idx = invoices.findIndex((inv) => inv.id === id);
  if (idx === -1) return undefined;
  invoices[idx] = { ...invoices[idx], status: "PAID", txHash, paidWith };
  writeInvoices(invoices);
  return invoices[idx];
}
