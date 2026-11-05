"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoiceStore_1 = require("../agent/invoiceStore");
const notificationStore_1 = require("../agent/notificationStore");
const userStore_1 = require("../agent/userStore");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : undefined;
        res.json({ invoices: await (0, invoiceStore_1.listInvoices)(walletAddress) });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load invoices" });
    }
});
router.get("/:id", async (req, res) => {
    const invoice = await (0, invoiceStore_1.getInvoice)(req.params.id);
    if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json({ invoice });
});
router.post("/", async (req, res) => {
    try {
        const { freelancerAddress, freelancerUsername, clientUsername, description, currency, amount, dueDate, acceptedSettlementCurrencies } = req.body;
        if (!freelancerAddress || !freelancerUsername || !clientUsername || !description || !amount || !currency || !dueDate) {
            res.status(400).json({ error: "freelancerUsername, freelancerAddress, clientUsername, description, currency, amount and dueDate are required" });
            return;
        }
        const client = await (0, userStore_1.findUser)(clientUsername);
        if (!client || client.role !== "client") {
            res.status(404).json({ error: `No client account exists for @${clientUsername.replace(/^@/, "")}` });
            return;
        }
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            res.status(400).json({ error: "amount must be positive" });
            return;
        }
        const settlementOptions = Array.isArray(acceptedSettlementCurrencies) && acceptedSettlementCurrencies.length
            ? acceptedSettlementCurrencies.filter((v) => v === "cNGN" || v === "USDC")
            : [currency === "USDC" ? "USDC" : "cNGN"];
        const invoice = await (0, invoiceStore_1.createInvoice)({
            freelancerUsername: String(freelancerUsername).replace(/^@/, "").toLowerCase(), freelancerAddress,
            clientUsername: String(clientUsername).replace(/^@/, "").toLowerCase(), description, currency,
            acceptedSettlementCurrencies: settlementOptions, amount: parsedAmount, dueDate,
        });
        await (0, notificationStore_1.createInvoiceNotification)(invoice.id, invoice.clientUsername, invoice.description, invoice.amount, invoice.currency);
        res.status(201).json({ invoice });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create invoice" });
    }
});
exports.default = router;
