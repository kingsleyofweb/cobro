/**
 * Typed API wrappers for the Cobro backend agent endpoints.
 * Import these in components instead of writing raw fetch() calls.
 */

const BACKEND_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL) ||
  "http://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CorridorInfo {
  corridor: "USDT" | "USDC";
  sellTokenAddress: string;
  sellTokenSymbol: "USDT" | "USDC";
  estimatedSellAmount: string;
  estimatedSellAmountFormatted: string;
  effectiveRate: number;
  liveData: boolean;
}

export interface AgentQuoteResponse {
  invoiceId: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  freelancerAddress: string;
  bestCorridor: "USDT" | "USDC";
  corridors: { USDT: CorridorInfo; USDC: CorridorInfo };
  savings: string;
  agentAddress: string | null;
  mode: "simulation" | "live";
}

export interface AgentExecuteResponse {
  /** Present in simulation and live modes */
  success?: boolean;
  invoiceId: string;
  txHash?: string;
  mode: "simulation" | "live" | "assisted";
  celoscanUrl?: string;
  paidWith: string;
  corridor: "USDT" | "USDC";
  /** Whether the Textile API returned a real market quote */
  liveTextileQuote?: boolean;
  /** Assisted mode only — client must sign this ERC-20 approval first */
  approvalTx?: { to: string; data: string; value: string; chainId: number };
  /** Assisted mode only — client signs this CobroInvoiceRouter call second */
  swapTx?: { to: string; data: string; value: string; chainId: number };
  sellAmount?: string;
  sellAmountFormatted?: string;
}

export interface AgentInfo {
  mode: "simulation" | "live";
  agentAddress: string | null;
  routerAddress: string | null;
  chainId: number;
}

export interface BackendInvoice {
  id: string;
  freelancerName: string;
  freelancerAddress: string;
  clientName: string;
  clientAddress: string;
  description: string;
  currency: "cNGN" | "wARS" | "wBRL";
  amount: number;
  amountFormatted: string;
  amountUnits: string;
  dueDate: string;
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith: string | null;
  createdAt: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

/** Fetch agent mode, wallet address, and router config */
export async function getAgentInfo(): Promise<AgentInfo | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/agent/info`);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

/** Fetch all invoices from the backend store */
export async function fetchInvoices(): Promise<BackendInvoice[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/invoices`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.invoices ?? null;
  } catch {
    return null;
  }
}

/** Create a new invoice on the backend */
export async function createInvoiceApi(data: {
  freelancerName: string;
  freelancerAddress: string;
  clientName: string;
  clientAddress: string;
  description: string;
  currency: "cNGN" | "wARS" | "wBRL";
  amount: number;
  dueDate: string;
}): Promise<BackendInvoice> {
  const res = await fetch(`${BACKEND_URL}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to create invoice");
  }
  const json = await res.json();
  return json.invoice;
}

/**
 * Ask the agent to compare USDT and USDC corridors and return the best route.
 * This is the agent's core intelligence — runs both quotes in parallel.
 */
export async function getAgentQuote(
  invoiceId: string,
  takerAddress?: string,
): Promise<AgentQuoteResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agent/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, takerAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Agent quote failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Instruct the agent to execute the payment for an invoice.
 * The agent requests a firm Textile quote and atomically settles on Celo.
 */
export async function executeAgentPayment(
  invoiceId: string,
  corridor: "USDT" | "USDC",
  takerAddress?: string,
): Promise<AgentExecuteResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, corridor, takerAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Agent execute failed: ${res.status}`);
  }
  return res.json();
}

/** Poll invoice payment status */
export async function getPaymentStatus(invoiceId: string) {
  const res = await fetch(`${BACKEND_URL}/api/agent/status/${invoiceId}`);
  return res.ok ? res.json() : null;
}

/**
 * Confirm a completed payment to the backend (assisted mode).
 * Called after the client's wallet has signed and broadcast the swap transaction.
 */
export async function confirmPayment(
  invoiceId: string,
  txHash: string,
  paidWith: string,
): Promise<void> {
  await fetch(`${BACKEND_URL}/api/agent/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, txHash, paidWith }),
  });
}
