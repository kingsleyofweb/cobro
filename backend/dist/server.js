"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const agent_1 = __importDefault(require("./routes/agent"));
const users_1 = __importDefault(require("./routes/users"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const wallet_1 = require("./agent/wallet");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
const textileApiBase = "https://api.textilecredit.com/v2";
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: allowedOrigins }));
app.use(express_1.default.json({ limit: "1mb" }));
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "cobro-backend" });
});
// ── Invoice persistence ──────────────────────────────────────────────────────
app.use("/api/invoices", invoices_1.default);
app.use("/api/users", users_1.default);
app.use("/api/notifications", notifications_1.default);
// ── Autonomous payment agent ─────────────────────────────────────────────────
app.use("/api/agent", agent_1.default);
// ── Textile RFQ proxy (kept for direct frontend use / legacy) ────────────────
async function proxyToTextile(path, body, includeApiKey = false) {
    const headers = { "Content-Type": "application/json" };
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
async function handleProxy(req, res, path, includeApiKey = false) {
    try {
        const result = await proxyToTextile(path, req.body, includeApiKey);
        res.status(result.status).json(result.data);
    }
    catch (error) {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown upstream error";
        res.status(502).json({ error: "Unable to submit transaction to Textile", details: message });
    }
});
app.listen(port, () => {
    const mode = (0, wallet_1.executionMode)();
    const modeLabel = {
        assisted: "🟢 CLIENT     (client wallet signs and pays Celo gas)",
        unavailable: "🔴 UNAVAILABLE (set TEXTILE_API_KEY for settlement quotes)",
    }[mode];
    console.log(`\n🚀 Cobro backend listening on http://localhost:${port}`);
    console.log(`   Agent mode:   ${modeLabel}`);
    console.log(`   Textile key:  ${process.env.TEXTILE_API_KEY ? "✅ set — live market rates" : "⬜ not set — settlement unavailable"}`);
    console.log(`   Admin key:    ${process.env.AGENT_PRIVATE_KEY ? "✅ set — deployment/admin only" : "⬜ not set — not required for payments"}`);
    console.log(`   RPC:          ${process.env.CELO_RPC_URL || "https://forno.celo.org (default)"}\n`);
});
