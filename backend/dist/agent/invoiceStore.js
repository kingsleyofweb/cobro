"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.getInvoice = getInvoice;
exports.listInvoices = listInvoices;
exports.markPaid = markPaid;
/**
 * Invoice persistence layer — stores invoices as a JSON file in backend/data/.
 * Seeded with demo invoices on first run so the app works out-of-the-box.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, "../../data");
const INVOICES_FILE = path_1.default.join(DATA_DIR, "invoices.json");
/** Demo invoices seeded on first run */
const SEED_INVOICES = [
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
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function readInvoices() {
    ensureDataDir();
    if (!fs_1.default.existsSync(INVOICES_FILE)) {
        writeInvoices(SEED_INVOICES);
        return [...SEED_INVOICES];
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(INVOICES_FILE, "utf-8"));
    }
    catch {
        return [...SEED_INVOICES];
    }
}
function writeInvoices(invoices) {
    ensureDataDir();
    fs_1.default.writeFileSync(INVOICES_FILE, JSON.stringify(invoices, null, 2), "utf-8");
}
function createInvoice(data) {
    const invoices = readInvoices();
    const idSuffix = String(invoices.length + 90).padStart(3, "0");
    const invoice = {
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
function getInvoice(id) {
    return readInvoices().find((inv) => inv.id === id);
}
function listInvoices() {
    return readInvoices();
}
function markPaid(id, txHash, paidWith) {
    const invoices = readInvoices();
    const idx = invoices.findIndex((inv) => inv.id === id);
    if (idx === -1)
        return undefined;
    invoices[idx] = { ...invoices[idx], status: "PAID", txHash, paidWith };
    writeInvoices(invoices);
    return invoices[idx];
}
