"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Agent API routes — the autonomous FX payment agent.
 *
 * How the Textile settlement works (no custom contract needed):
 *   1. Agent calls Textile /v2/rfq/request with:
 *        - sellToken: USDT or USDC (whichever is cheaper for client)
 *        - buyToken:  cNGN
 *        - buyAmount: exact invoice amount in cNGN units
 *        - taker:     client's wallet (who pays USDT)
 *        - recipient: freelancer's wallet (who receives cNGN ← KEY!)
 *   2. Textile returns two ready-to-sign transactions:
 *        - approvalTx: ERC-20 approve(spender, amount) on USDT
 *        - swapTx:     LimitOrderReactor.execute() — settles USDT→cNGN atomically
 *   3. Client signs and broadcasts the returned transactions, paying Celo gas.
 *
 * GET  /api/agent/info              — mode, agent address, Textile key status
 * POST /api/agent/quote             — compare accepted cNGN/USDC outputs
 * POST /api/agent/execute           — get firm quote + settle
 * POST /api/agent/confirm           — record client txHash (assisted mode)
 * GET  /api/agent/status/:invoiceId — poll payment status
 */
const express_1 = require("express");
const rateOptimizer_1 = require("../agent/rateOptimizer");
const invoiceStore_1 = require("../agent/invoiceStore");
const wallet_1 = require("../agent/wallet");
const celo_1 = require("../config/celo");
const router = (0, express_1.Router)();
const TEXTILE_API_BASE = "https://api.textilecredit.com/v2";
// ---------------------------------------------------------------------------
// GET /api/agent/info
// ---------------------------------------------------------------------------
router.get("/info", async (_req, res) => {
    const agentAddress = await (0, wallet_1.getAgentAddress)();
    const mode = (0, wallet_1.executionMode)();
    res.json({
        mode,
        agentAddress,
        textileKeySet: !!process.env.TEXTILE_API_KEY,
        chainId: celo_1.CELO_CONFIG.chainId,
        rpcUrl: celo_1.CELO_CONFIG.rpcUrl,
    });
});
// ---------------------------------------------------------------------------
// POST /api/agent/quote
// Body: { invoiceId: string, takerAddress?: string }
// ---------------------------------------------------------------------------
router.post("/quote", async (req, res) => {
    try {
        const { invoiceId, takerAddress } = req.body;
        if (!invoiceId) {
            res.status(400).json({ error: "invoiceId is required" });
            return;
        }
        const invoice = (0, invoiceStore_1.getInvoice)(invoiceId);
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status === "PAID") {
            res.status(400).json({ error: "Invoice already paid" });
            return;
        }
        const acceptedCurrencies = invoice.acceptedSettlementCurrencies ?? (invoice.currency === "USDC" ? ["USDC"] : ["cNGN"]);
        const optimalRoute = await (0, rateOptimizer_1.getOptimalRoute)(invoice.amountUnits, acceptedCurrencies);
        const agentAddress = await (0, wallet_1.getAgentAddress)();
        res.json({
            invoiceId: invoice.id,
            invoiceAmount: invoice.amountFormatted,
            invoiceCurrency: invoice.currency,
            freelancerAddress: invoice.freelancerAddress,
            bestSettlementCurrency: optimalRoute.bestSettlementCurrency,
            settlements: optimalRoute.settlements,
            acceptedSettlementCurrencies: acceptedCurrencies,
            savings: optimalRoute.savings,
            agentAddress,
            mode: (0, wallet_1.executionMode)(),
            textileKeySet: !!process.env.TEXTILE_API_KEY,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: "Failed to get agent quote", details: message });
    }
});
// ---------------------------------------------------------------------------
// POST /api/agent/execute
// Body: { invoiceId: string, settlementCurrency: "cNGN"|"USDC", takerAddress?: string }
//
// Flow:
//   1. Get indicative route from rateOptimizer
//   2. Call Textile /rfq/request with recipient = freelancerAddress
//   3a. LIVE:      agent signs both Textile txns → returns txHash
//   3b. ASSISTED:  returns unsigned Textile txns for client MetaMask
//   3c. SIMULATION: returns fake txHash
// ---------------------------------------------------------------------------
router.post("/execute", async (req, res) => {
    try {
        const { invoiceId, settlementCurrency, takerAddress } = req.body;
        if (!invoiceId || !settlementCurrency) {
            res.status(400).json({ error: "invoiceId and settlementCurrency are required" });
            return;
        }
        if (!["cNGN", "USDC"].includes(settlementCurrency)) {
            res.status(400).json({ error: "settlementCurrency must be cNGN or USDC" });
            return;
        }
        if (!takerAddress) {
            res.status(400).json({
                error: "takerAddress is required: the client wallet must authorize and pay this transaction",
            });
            return;
        }
        const invoice = (0, invoiceStore_1.getInvoice)(invoiceId);
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status === "PAID") {
            res.status(400).json({ error: "Invoice already paid" });
            return;
        }
        const acceptedCurrencies = invoice.acceptedSettlementCurrencies ?? (invoice.currency === "USDC" ? ["USDC"] : ["cNGN"]);
        if (!acceptedCurrencies.includes(settlementCurrency)) {
            res.status(400).json({ error: `Invoice does not accept ${settlementCurrency} settlement` });
            return;
        }
        // ── Step 1: Compare live output-currency routes ───────────────────────
        const optimalRoute = await (0, rateOptimizer_1.getOptimalRoute)(invoice.amountUnits, acceptedCurrencies);
        const settlementQuote = optimalRoute.settlements[settlementCurrency];
        if (!settlementQuote?.available) {
            res.status(409).json({ error: settlementQuote?.reason || `${settlementCurrency} route unavailable` });
            return;
        }
        // ── Step 2: Get real 60s firm quote from Textile ──────────────────────
        let firmSellAmount = settlementQuote.estimatedSellAmount;
        let firmSellFormatted = settlementQuote.estimatedSellAmountFormatted;
        let liveTextileQuote = false;
        let quoteExpiresAt = null;
        let textileApprovalTx = null;
        let textileSwapTx = null;
        try {
            const headers = { "Content-Type": "application/json" };
            if (process.env.TEXTILE_API_KEY) {
                headers["Authorization"] = `Bearer ${process.env.TEXTILE_API_KEY}`;
            }
            const rfqBody = {
                chainId: celo_1.CELO_CONFIG.chainId,
                sellToken: celo_1.CELO_CONFIG.tokens.USDT.address,
                buyToken: settlementQuote.buyTokenAddress,
                buyAmount: settlementQuote.estimatedBuyAmount,
                taker: takerAddress,
                recipient: invoice.freelancerAddress, // ← cNGN delivered directly to freelancer
            };
            const quoteRes = await fetch(`${TEXTILE_API_BASE}/rfq/request`, {
                method: "POST",
                headers,
                body: JSON.stringify(rfqBody),
                signal: AbortSignal.timeout(10_000),
            });
            if (quoteRes.ok) {
                const json = await quoteRes.json();
                const payload = json.data ?? json;
                // v2 returns quote fields under data.quote, while older responses
                // placed them directly under data. Support both shapes.
                const quote = payload.quote ?? payload;
                const transactions = payload.transactions ?? quote.transactions;
                // takerPays is the exact amount debited from the client's wallet,
                // including Textile's protocol fee. Approve this exact amount.
                const exactTakerPays = quote?.takerPays ?? quote?.sellAmount;
                if (exactTakerPays) {
                    firmSellAmount = String(exactTakerPays);
                    const sellDecimals = celo_1.CELO_CONFIG.tokens.USDT.decimals;
                    firmSellFormatted = (Number(firmSellAmount) / 10 ** sellDecimals).toFixed(2);
                    liveTextileQuote = true;
                }
                quoteExpiresAt = quote?.expiresAt ?? null;
                // Textile returns pre-built, ready-to-sign transactions
                if (transactions?.approval) {
                    textileApprovalTx = {
                        to: transactions.approval.to,
                        data: transactions.approval.data,
                        value: transactions.approval.value ?? "0x0",
                        chainId: celo_1.CELO_CONFIG.chainId,
                    };
                }
                if (transactions?.swap) {
                    textileSwapTx = {
                        to: transactions.swap.to,
                        data: transactions.swap.data,
                        value: transactions.swap.value ?? "0x0",
                        chainId: celo_1.CELO_CONFIG.chainId,
                    };
                }
            }
            else {
                const errText = await quoteRes.text().catch(() => "");
                console.warn(`[Textile] RFQ request failed ${quoteRes.status}: ${errText.slice(0, 200)}`);
            }
        }
        catch (rfqErr) {
            console.warn("[Textile] RFQ unavailable:", rfqErr);
        }
        const paidWith = `${firmSellFormatted} USDT → ${settlementCurrency}`;
        // ── CLIENT MODE: return unsigned txns; client wallet pays gas ─────────
        if (textileSwapTx) {
            return res.json({
                mode: "assisted",
                invoiceId: invoice.id,
                settlementCurrency,
                paidWith,
                liveTextileQuote,
                freelancerAddress: invoice.freelancerAddress,
                sellAmount: firmSellAmount,
                sellAmountFormatted: firmSellFormatted,
                quoteExpiresAt,
                // Client must sign these two transactions in order:
                approvalTx: textileApprovalTx, // 1. approve USDT for Textile spender
                swapTx: textileSwapTx, // 2. execute USDT→cNGN swap via LimitOrderReactor
            });
        }
        res.status(503).json({
            error: "Textile did not return a settlement transaction",
            details: "Configure a Textile API key with RFQ request access before accepting mainnet payments.",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[Agent] Execute error:", message);
        res.status(500).json({ error: "Failed to execute payment", details: message });
    }
});
// ---------------------------------------------------------------------------
// POST /api/agent/confirm
// Called by the frontend after client's MetaMask confirms the swap tx.
// Body: { invoiceId, txHash, paidWith }
// ---------------------------------------------------------------------------
router.post("/confirm", (req, res) => {
    const { invoiceId, txHash, paidWith } = req.body;
    if (!invoiceId || !txHash) {
        res.status(400).json({ error: "invoiceId and txHash are required" });
        return;
    }
    const updated = (0, invoiceStore_1.markPaid)(invoiceId, txHash, paidWith || "");
    if (!updated) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json({
        success: true,
        invoiceId: updated.id,
        txHash: updated.txHash,
        celoscanUrl: `${celo_1.CELO_CONFIG.explorerUrl}/tx/${txHash}`,
        invoice: updated,
    });
});
// ---------------------------------------------------------------------------
// GET /api/agent/status/:invoiceId
// ---------------------------------------------------------------------------
router.get("/status/:invoiceId", (req, res) => {
    const invoice = (0, invoiceStore_1.getInvoice)(req.params.invoiceId);
    if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json({
        invoiceId: invoice.id,
        status: invoice.status,
        txHash: invoice.txHash,
        paidWith: invoice.paidWith,
        celoscanUrl: invoice.txHash
            ? `${celo_1.CELO_CONFIG.explorerUrl}/tx/${invoice.txHash}`
            : null,
    });
});
exports.default = router;
