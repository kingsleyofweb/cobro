/**
 * Invoice CRUD routes.
 * GET  /api/invoices        — list all invoices
 * GET  /api/invoices/:id    — get a single invoice
 * POST /api/invoices        — create a new invoice (freelancer)
 */
import { Router, Request, Response } from "express";
import { createInvoice, listInvoices, getInvoice } from "../agent/invoiceStore";

const router = Router();

// GET /api/invoices
router.get("/", (_req: Request, res: Response) => {
  const invoices = listInvoices();
  res.json({ invoices });
});

// GET /api/invoices/:id
router.get("/:id", (req: Request, res: Response) => {
  const invoice = getInvoice(req.params.id as string);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json({ invoice });
});

// POST /api/invoices
router.post("/", (req: Request, res: Response) => {
  const {
    freelancerName,
    freelancerAddress,
    clientName,
    clientAddress,
    description,
    currency,
    amount,
    dueDate,
    acceptedSettlementCurrencies,
  } = req.body;

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

  const settlementOptions: ("cNGN" | "USDC")[] = Array.isArray(acceptedSettlementCurrencies) && acceptedSettlementCurrencies.length > 0
    ? acceptedSettlementCurrencies.filter((value: unknown): value is "cNGN" | "USDC" => value === "cNGN" || value === "USDC")
    : [currency === "USDC" ? "USDC" : "cNGN"];

  const invoice = createInvoice({
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

export default router;
