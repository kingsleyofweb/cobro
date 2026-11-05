/**
 * Payment Executor — executes the atomic invoice settlement on Celo.
 *
 * SIMULATION mode (default, no AGENT_PRIVATE_KEY): returns a realistic mock
 * transaction hash instantly — fully demonstrable without a real wallet.
 *
 * LIVE mode (AGENT_PRIVATE_KEY + COBRO_ROUTER_ADDRESS set): executes the
 * real 4-step on-chain flow:
 *   1. Pull sell token (USDT/USDC) from client → agent
 *   2. Agent approves CobroInvoiceRouter to pull from agent
 *   3. Agent calls CobroInvoiceRouter.payInvoiceWithTextileSwap()
 *   4. Router executes Textile's UniswapX calldata → cNGN delivered to freelancer
 */
import crypto from "crypto";
import { ethers } from "ethers";
import { CELO_CONFIG } from "../config/celo";
import { getAgentSigner, isLiveMode } from "./wallet";

export interface ExecuteParams {
  invoiceId: string;
  freelancerAddress: string;
  clientAddress: string;
  sellTokenSymbol: "USDT" | "USDC";
  sellTokenAddress: string;
  /** Atomic units — the sell amount from the firm Textile quote */
  maxSellAmountUnits: string;
  buyTokenAddress: string;
  /** Atomic units — exact amount the freelancer must receive */
  exactBuyAmountUnits: string;
  /** Raw calldata from Textile's transactions.swap.data field */
  textileSwapCalldata: string;
}

export interface ExecuteResult {
  txHash: string;
  mode: "simulation" | "live";
  celoscanUrl: string;
}

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];

const COBRO_ROUTER_ABI = [
  "function payInvoiceWithTextileSwap(" +
    "bytes32 invoiceId, address freelancer, address sellToken, " +
    "uint256 maxSellAmount, address buyToken, uint256 exactBuyAmount, " +
    "bytes calldata textileSwapCalldata" +
  ") returns (bool)",
];

export async function executePayment(params: ExecuteParams): Promise<ExecuteResult> {
  if (!isLiveMode()) {
    return simulatePayment();
  }
  return livePayment(params);
}

function simulatePayment(): ExecuteResult {
  const txHash = "0x" + crypto.randomBytes(32).toString("hex");
  return {
    txHash,
    mode: "simulation",
    celoscanUrl: `${CELO_CONFIG.explorerUrl}/tx/${txHash}`,
  };
}

async function livePayment(params: ExecuteParams): Promise<ExecuteResult> {
  const signer = getAgentSigner();
  const agentAddress = signer.address;
  const routerAddress = CELO_CONFIG.contracts.cobroRouter;

  if (!routerAddress) {
    throw new Error("COBRO_ROUTER_ADDRESS is not configured.");
  }

  // Cast to any to avoid ethers CJS/ESM private-field type mismatch
  const signerAny = signer as any;
  const sellToken = new ethers.Contract(params.sellTokenAddress, ERC20_ABI, signerAny);
  const router = new ethers.Contract(routerAddress, COBRO_ROUTER_ABI, signerAny);

  // Step 1 — Verify client has approved the agent to move their sell token
  const clientAllowance: bigint = await sellToken.allowance(
    params.clientAddress,
    agentAddress,
  );
  if (clientAllowance < BigInt(params.maxSellAmountUnits)) {
    throw new Error(
      `Insufficient client allowance. ` +
      `Client (${params.clientAddress}) must call ` +
      `${params.sellTokenSymbol}.approve("${agentAddress}", ${params.maxSellAmountUnits}) ` +
      `before the agent can execute.`,
    );
  }

  // Step 2 — Pull sell token from client to agent
  const pullTx = await sellToken.transferFrom(
    params.clientAddress,
    agentAddress,
    params.maxSellAmountUnits,
  );
  await pullTx.wait(1);

  // Step 3 — Agent approves the CobroInvoiceRouter to pull from agent
  const approveTx = await sellToken.approve(routerAddress, params.maxSellAmountUnits);
  await approveTx.wait(1);

  // Step 4 — Execute atomic swap via CobroInvoiceRouter
  const invoiceIdBytes32 = ethers.encodeBytes32String(params.invoiceId.slice(0, 31));
  const tx = await router.payInvoiceWithTextileSwap(
    invoiceIdBytes32,
    params.freelancerAddress,
    params.sellTokenAddress,
    params.maxSellAmountUnits,
    params.buyTokenAddress,
    params.exactBuyAmountUnits,
    params.textileSwapCalldata,
  );

  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    mode: "live",
    celoscanUrl: `${CELO_CONFIG.explorerUrl}/tx/${receipt.hash}`,
  };
}
