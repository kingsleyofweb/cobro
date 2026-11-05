import "dotenv/config";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";

import invoiceRoutes from "./routes/invoices";
import agentRoutes from "./routes/agent";
import { executionMode } from "./agent/wallet";

const app = express();
const port = Number(process.env.PORT || 4000);
const textileApiBase = "https://api.textilecredit.com/v2";

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cobro-backend" });
});

// ── Invoice persistence ──────────────────────────────────────────────────────
app.use("/api/invoices", invoiceRoutes);

// ── Autonomous payment agent ─────────────────────────────────────────────────
app.use("/api/agent", agentRoutes);

// ── Textile RFQ proxy (kept for direct frontend use / legacy) ────────────────
async function proxyToTextile(
  path: string,
  body: unknown,
  includeApiKey = false,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (includeApiKey && process.env.TEXTILE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.TEXTILE_API_KEY}`;
  }

  const response = await fetch(`${textileApiBase}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function handleProxy(req: Request, res: Response, path: string, includeApiKey = false) {
  try {
    const result = await proxyToTextile(path, req.body, includeApiKey);
    res.status(result.status).json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    res.status(502).json({ error: "Unable to connect to Textile RFQ API", details: message });
  }
}

app.post("/api/rfq/preview", (req, res) => handleProxy(req, res, "/rfq/preview"));
app.post("/api/rfq/request", (req, res) => handleProxy(req, res, "/rfq/request", true));
app.post("/api/rfq/:quoteId/submit", async (req, res) => {
  try {
    const response = await fetch(`${textileApiBase}/rfq/${encodeURIComponent(req.params.quoteId)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    res.status(502).json({ error: "Unable to submit transaction to Textile", details: message });
  }
});

app.listen(port, () => {
  const mode = executionMode();
  const modeLabel = {
    live:        "🔴 LIVE       (agent signs Textile txns autonomously)",
    assisted:    "🟠 ASSISTED   (client MetaMask signs Textile txns)",
    simulation:  "🟡 SIMULATION (fake txHash — set TEXTILE_API_KEY for real rates)",
  }[mode];

  console.log(`\n🚀 Cobro backend listening on http://localhost:${port}`);
  console.log(`   Agent mode:   ${modeLabel}`);
  console.log(`   Textile key:  ${process.env.TEXTILE_API_KEY ? "✅ set — live market rates" : "⬜ not set — simulated rates"}`);
  console.log(`   Agent wallet: ${process.env.AGENT_PRIVATE_KEY ? "✅ set — autonomous execution" : "⬜ not set — client signs"}`);
  console.log(`   RPC:          ${process.env.CELO_RPC_URL || "https://forno.celo.org (default)"}\n`);
});
