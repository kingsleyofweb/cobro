/**
 * Invoice persistence layer — stores invoices as a JSON file in backend/data/.
 * Seeded with demo invoices on first run so the app works out-of-the-box.
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
  currency: "cNGN" | "wARS" | "wBRL";
  amount: number;          // human-readable (e.g. 500000)
  amountFormatted: string; // comma-formatted (e.g. "500,000")
  amountUnits: string;     // atomic units, 6 decimals (e.g. "500000000000")
  dueDate: string;         // ISO date string
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith: string | null; // e.g. "331.42 USDT"
  createdAt: string;
}

/** Demo invoices seeded on first run */
const SEED_INVOICES: Invoice[] = [
  {
    id: "INV-2026-089",
    freelancerName: "Amara Okonkwo",
    freelancerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    clientName: "Acme Web3 Labs",
    clientAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    description: "Full-Stack Smart Contract & Frontend Audit",
    currency: "cNGN",
    amount: 500000,
    amountFormatted: "500,000",
    amountUnits: "500000000000",
    dueDate: "2026-11-05",
    status: "UNPAID",
    txHash: null,
    paidWith: null,
    createdAt: new Date("2026-11-01").toISOString(),
  },
  {
    id: "INV-2026-088",
    freelancerName: "Amara Okonkwo",
    freelancerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    clientName: "Global DAO Ops",
    clientAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    description: "DeFi Cross-Border Payment Integration Guide",
    currency: "cNGN",
    amount: 350000,
    amountFormatted: "350,000",
    amountUnits: "350000000000",
    dueDate: "2026-10-20",
    status: "PAID",
    txHash: "0x8fa92305710bcba726190db957263b610c495810bde4726105820bbda0182650",
    paidWith: "231.00 USDT",
    createdAt: new Date("2026-10-15").toISOString(),
  },
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readInvoices(): Invoice[] {
  ensureDataDir();
  if (!fs.existsSync(INVOICES_FILE)) {
    writeInvoices(SEED_INVOICES);
    return [...SEED_INVOICES];
  }
  try {
    return JSON.parse(fs.readFileSync(INVOICES_FILE, "utf-8")) as Invoice[];
  } catch {
    return [...SEED_INVOICES];
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
