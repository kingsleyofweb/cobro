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
 * Invoice persistence layer — stores real invoices as a JSON file in backend/data/.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, "../../data");
const INVOICES_FILE = path_1.default.join(DATA_DIR, "invoices.json");
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function readInvoices() {
    ensureDataDir();
    if (!fs_1.default.existsSync(INVOICES_FILE)) {
        writeInvoices([]);
        return [];
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(INVOICES_FILE, "utf-8"));
    }
    catch {
        return [];
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
