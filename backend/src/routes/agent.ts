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
 *   3a. LIVE mode:    agent (holding USDT) signs and broadcasts both
 *   3b. ASSISTED mode: transactions returned to client's MetaMask to sign
 *   3c. SIMULATION:  fake txHash when no Textile API key is set
 *
 * GET  /api/agent/info              — mode, agent address, Textile key status
 * POST /api/agent/quote             — compare USDT & USDC corridors
 * POST /api/agent/execute           — get firm quote + settle
 * POST /api/agent/confirm           — record client txHash (assisted mode)
 * GET  /api/agent/status/:invoiceId — poll payment status
 */
import { Router, Request, Response } from "express";
import { getOptimalRoute } from "../agent/rateOptimizer";
import { executePayment } from "../agent/paymentExecutor";
import { getInvoice, markPaid } from "../agent/invoiceStore";
import {
  getAgentAddress,
  getAgentSigner,
  getProvider,
  isLiveMode,
  executionMode,
} from "../agent/wallet";
import { CELO_CONFIG } from "../config/celo";

const router = Router();
const TEXTILE_API_BASE = "https://api.textilecredit.com/v2";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface TxPayload {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

// ---------------------------------------------------------------------------
// GET /api/agent/info
// ---------------------------------------------------------------------------
router.get("/info", async (_req: Request, res: Response) => {
  const agentAddress = await getAgentAddress();
  const mode = executionMode();
  res.json({
    mode,
    agentAddress,
    textileKeySet: !!process.env.TEXTILE_API_KEY,
    chainId: CELO_CONFIG.chainId,
    rpcUrl: CELO_CONFIG.rpcUrl,
  });
});

// ---------------------------------------------------------------------------
// POST /api/agent/quote
// Body: { invoiceId: string, takerAddress?: string }
// ---------------------------------------------------------------------------
router.post("/quote", async (req: Request, res: Response) => {
  try {
    const { invoiceId, takerAddress } = req.body as {
      invoiceId?: string;
      takerAddress?: string;
    };

    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    const invoice = getInvoice(invoiceId);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.status === "PAID") { res.status(400).json({ error: "Invoice already paid" }); return; }

    const optimalRoute = await getOptimalRoute(invoice.amountUnits);
    const agentAddress = await getAgentAddress();

    res.json({
      invoiceId: invoice.id,
      invoiceAmount: invoice.amountFormatted,
      invoiceCurrency: invoice.currency,
      freelancerAddress: invoice.freelancerAddress,
      bestCorridor: optimalRoute.bestCorridor,
      corridors: optimalRoute.corridors,
      savings: optimalRoute.savings,
      agentAddress,
      mode: executionMode(),
      textileKeySet: !!process.env.TEXTILE_API_KEY,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Failed to get agent quote", details: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent/execute
// Body: { invoiceId: string, corridor: "USDT"|"USDC", takerAddress?: string }
//
// Flow:
//   1. Get indicative route from rateOptimizer
//   2. Call Textile /rfq/request with recipient = freelancerAddress
//   3a. LIVE:      agent signs both Textile txns → returns txHash
//   3b. ASSISTED:  returns unsigned Textile txns for client MetaMask
//   3c. SIMULATION: returns fake txHash
// ---------------------------------------------------------------------------
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { invoiceId, corridor, takerAddress } = req.body as {
      invoiceId?: string;
      corridor?: "USDT" | "USDC";
      takerAddress?: string;
    };

    if (!invoiceId || !corridor) {
      res.status(400).json({ error: "invoiceId and corridor are required" });
      return;
    }
    if (!["USDT", "USDC"].includes(corridor)) {
      res.status(400).json({ error: "corridor must be USDT or USDC" });
      return;
    }

    const invoice = getInvoice(invoiceId);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.status === "PAID") { res.status(400).json({ error: "Invoice already paid" }); return; }

    // ── Step 1: Get indicative quotes (USDT vs USDC) ──────────────────────
    const optimalRoute = await getOptimalRoute(invoice.amountUnits);
    const corridorQuote = optimalRoute.corridors[corridor];

    // ── Step 2: Get real 60s firm quote from Textile ──────────────────────
    let firmSellAmount = corridorQuote.estimatedSellAmount;
    let firmSellFormatted = corridorQuote.estimatedSellAmountFormatted;
    let liveTextileQuote = false;
    let textileApprovalTx: TxPayload | null = null;
    let textileSwapTx: TxPayload | null = null;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.TEXTILE_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.TEXTILE_API_KEY}`;
      }

      // In LIVE mode the agent is the taker (holds USDT itself)
      // In ASSISTED mode the client is the taker
      const effectiveTaker = isLiveMode()
        ? (await getAgentAddress()) ?? ZERO_ADDRESS
        : takerAddress ?? ZERO_ADDRESS;

      const rfqBody = {
        chainId: CELO_CONFIG.chainId,
        sellToken: corridorQuote.sellTokenAddress,
        buyToken: CELO_CONFIG.tokens.cNGN.address,
        buyAmount: invoice.amountUnits,   // exact cNGN freelancer should receive
        taker: effectiveTaker,
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
        const quote = json.data ?? json;

        if (quote?.sellAmount) {
          firmSellAmount = String(quote.sellAmount);
          const sellDecimals = CELO_CONFIG.tokens[corridor as "USDT" | "USDC"].decimals;
          firmSellFormatted = (Number(firmSellAmount) / 10 ** sellDecimals).toFixed(2);
          liveTextileQuote = true;
        }

        // Textile returns pre-built, ready-to-sign transactions
        if (quote?.transactions?.approval) {
          textileApprovalTx = {
            to: quote.transactions.approval.to,
            data: quote.transactions.approval.data,
            value: quote.transactions.approval.value ?? "0x0",
            chainId: CELO_CONFIG.chainId,
          };
        }
        if (quote?.transactions?.swap) {
          textileSwapTx = {
            to: quote.transactions.swap.to,
            data: quote.transactions.swap.data,
            value: quote.transactions.swap.value ?? "0x0",
            chainId: CELO_CONFIG.chainId,
          };
        }
      } else {
        const errText = await quoteRes.text().catch(() => "");
        console.warn(`[Textile] RFQ request failed ${quoteRes.status}: ${errText.slice(0, 200)}`);
      }
    } catch (rfqErr) {
      console.warn("[Textile] RFQ unavailable — falling back to simulation:", rfqErr);
    }

    const paidWith = `${firmSellFormatted} ${corridor}`;

    // ── LIVE MODE: agent signs both Textile transactions ──────────────────
    if (isLiveMode() && textileSwapTx) {
      const signer = getAgentSigner();

      if (textileApprovalTx) {
        const approveTx = await signer.sendTransaction({
          to: textileApprovalTx.to,
          data: textileApprovalTx.data,
        });
        await approveTx.wait(1);
        console.log(`[Agent] Approval confirmed: ${approveTx.hash}`);
      }

      const swapTx = await signer.sendTransaction({
        to: textileSwapTx.to,
        data: textileSwapTx.data,
      });
      const receipt = await swapTx.wait(1);
      const txHash = receipt!.hash;
      console.log(`[Agent] Swap confirmed: ${txHash}`);

      const updatedInvoice = markPaid(invoice.id, txHash, paidWith);
      return res.json({
        success: true,
        mode: "live",
        invoiceId: invoice.id,
        txHash,
        celoscanUrl: `${CELO_CONFIG.explorerUrl}/tx/${txHash}`,
        paidWith,
        corridor,
        liveTextileQuote,
        freelancerAddress: invoice.freelancerAddress,
        updatedInvoice,
      });
    }

    // ── ASSISTED MODE: return unsigned txns for client wallet ─────────────
    if (textileSwapTx && takerAddress) {
      return res.json({
        mode: "assisted",
        invoiceId: invoice.id,
        corridor,
        paidWith,
        liveTextileQuote,
        freelancerAddress: invoice.freelancerAddress,
        sellAmount: firmSellAmount,
        sellAmountFormatted: firmSellFormatted,
        // Client must sign these two transactions in order:
        approvalTx: textileApprovalTx,  // 1. approve USDT for Textile spender
        swapTx: textileSwapTx,          // 2. execute USDT→cNGN swap via LimitOrderReactor
      });
    }

    // ── SIMULATION MODE: return deterministic fake txHash ────────────────
    const result = await executePayment({
      invoiceId: invoice.id,
      freelancerAddress: invoice.freelancerAddress,
      clientAddress: takerAddress || invoice.clientAddress,
      sellTokenSymbol: corridor,
      sellTokenAddress: corridorQuote.sellTokenAddress,
      maxSellAmountUnits: firmSellAmount,
      buyTokenAddress: CELO_CONFIG.tokens.cNGN.address,
      exactBuyAmountUnits: invoice.amountUnits,
      textileSwapCalldata: textileSwapTx?.data ?? "0x",
    });

    const updatedInvoice = markPaid(invoice.id, result.txHash, paidWith);
    return res.json({
      success: true,
      mode: result.mode,
      invoiceId: invoice.id,
      txHash: result.txHash,
      celoscanUrl: result.celoscanUrl,
      paidWith,
      corridor,
      liveTextileQuote,
      freelancerAddress: invoice.freelancerAddress,
      updatedInvoice,
    });

  } catch (error) {
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
router.post("/confirm", (req: Request, res: Response) => {
  const { invoiceId, txHash, paidWith } = req.body as {
    invoiceId?: string;
    txHash?: string;
    paidWith?: string;
  };

  if (!invoiceId || !txHash) {
    res.status(400).json({ error: "invoiceId and txHash are required" });
    return;
  }

  const updated = markPaid(invoiceId, txHash, paidWith || "");
  if (!updated) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json({
    success: true,
    invoiceId: updated.id,
    txHash: updated.txHash,
    celoscanUrl: `${CELO_CONFIG.explorerUrl}/tx/${txHash}`,
    invoice: updated,
  });
});

// ---------------------------------------------------------------------------
// GET /api/agent/status/:invoiceId
// ---------------------------------------------------------------------------
router.get("/status/:invoiceId", (req: Request, res: Response) => {
  const invoice = getInvoice(req.params.invoiceId as string);
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
      ? `${CELO_CONFIG.explorerUrl}/tx/${invoice.txHash}`
      : null,
  });
});

export default router;
