"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Invoice CRUD routes.
 * GET  /api/invoices        — list all invoices
 * GET  /api/invoices/:id    — get a single invoice
 * POST /api/invoices        — create a new invoice (freelancer)
 */
const express_1 = require("express");
const invoiceStore_1 = require("../agent/invoiceStore");
const router = (0, express_1.Router)();
// GET /api/invoices
router.get("/", (_req, res) => {
    const invoices = (0, invoiceStore_1.listInvoices)();
    res.json({ invoices });
});
// GET /api/invoices/:id
router.get("/:id", (req, res) => {
    const invoice = (0, invoiceStore_1.getInvoice)(req.params.id);
    if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json({ invoice });
});
// POST /api/invoices
router.post("/", (req, res) => {
    const { freelancerName, freelancerAddress, clientName, clientAddress, description, currency, amount, dueDate, acceptedSettlementCurrencies, } = req.body;
    if (!freelancerName || !freelancerAddress || !clientName || !description || !amount || !currency || !dueDate) {
        res.status(400).json({
            error: "Missing required fields",
            required: ["freelancerName", "freelancerAddress", "clientName", "description", "amount", "currency", "dueDate"],
        });
        return;
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({ error: "amount must be a positive number" });
        return;
    }
    const settlementOptions = Array.isArray(acceptedSettlementCurrencies) && acceptedSettlementCurrencies.length > 0
        ? acceptedSettlementCurrencies.filter((value) => value === "cNGN" || value === "USDC")
        : [currency === "USDC" ? "USDC" : "cNGN"];
    const invoice = (0, invoiceStore_1.createInvoice)({
        freelancerName,
        freelancerAddress,
        clientName,
        clientAddress: clientAddress || "0x0000000000000000000000000000000000000000",
        description,
        currency,
        acceptedSettlementCurrencies: settlementOptions,
        amount: parsedAmount,
        dueDate,
    });
    res.status(201).json({ invoice });
});
exports.default = router;
