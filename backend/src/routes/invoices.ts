import { Router, Request, Response } from "express";
import { createInvoice, listInvoices, getInvoice } from "../agent/invoiceStore";
import { createInvoiceNotification } from "../agent/notificationStore";
import { findUser } from "../agent/userStore";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : undefined;
    res.json({ invoices: await listInvoices(walletAddress) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load invoices" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const invoice = await getInvoice(req.params.id as string);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json({ invoice });
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { freelancerAddress, freelancerUsername, clientUsername, description, currency, amount, dueDate, acceptedSettlementCurrencies } = req.body;
    if (!freelancerAddress || !freelancerUsername || !clientUsername || !description || !amount || !currency || !dueDate) {
      res.status(400).json({ error: "freelancerUsername, freelancerAddress, clientUsername, description, currency, amount and dueDate are required" }); return;
    }
    const client = await findUser(clientUsername);
    if (!client || client.role !== "client") {
      res.status(404).json({ error: `No client account exists for @${clientUsername.replace(/^@/, "")}` }); return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { res.status(400).json({ error: "amount must be positive" }); return; }
    const settlementOptions: ("cNGN" | "USDC")[] = Array.isArray(acceptedSettlementCurrencies) && acceptedSettlementCurrencies.length
      ? acceptedSettlementCurrencies.filter((v: unknown): v is "cNGN" | "USDC" => v === "cNGN" || v === "USDC")
      : [currency === "USDC" ? "USDC" : "cNGN"];
    const invoice = await createInvoice({
      freelancerUsername: String(freelancerUsername).replace(/^@/, "").toLowerCase(), freelancerAddress,
      clientUsername: String(clientUsername).replace(/^@/, "").toLowerCase(), description, currency,
      acceptedSettlementCurrencies: settlementOptions, amount: parsedAmount, dueDate,
    });
    await createInvoiceNotification(invoice.id, invoice.clientUsername, invoice.description, invoice.amount, invoice.currency);
    res.status(201).json({ invoice });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create invoice" });
  }
});

export default router;
