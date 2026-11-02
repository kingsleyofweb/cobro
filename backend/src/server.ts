import "dotenv/config";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cobro-backend" });
});

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
  console.log(`Cobro backend listening on http://localhost:${port}`);
});
