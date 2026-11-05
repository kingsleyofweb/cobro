/**
 * Agent wallet — manages the Cobro Agent's own Celo EOA.
 *
 * LIVE mode      = AGENT_PRIVATE_KEY set → agent signs both Textile txns autonomously
 * ASSISTED mode  = no AGENT_PRIVATE_KEY  → backend returns unsigned txns, client's
 *                  MetaMask signs and broadcasts them
 * SIMULATION mode = no key, no Textile API key → returns fake txHash (dev/demo)
 */
import { ethers } from "ethers";
import { CELO_CONFIG } from "../config/celo";

/** Lazy singleton provider connected to Celo */
let _provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(CELO_CONFIG.rpcUrl);
  }
  return _provider;
}

/**
 * Returns the agent's signer connected to Celo.
 * Throws if AGENT_PRIVATE_KEY is not set — caller must check isLiveMode() first.
 */
export function getAgentSigner(): ethers.Wallet {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not configured. " +
      "Set it in backend/.env to enable live on-chain execution."
    );
  }
  return new ethers.Wallet(privateKey, getProvider());
}

/** Returns the agent's public address, or null in simulation/assisted mode */
export async function getAgentAddress(): Promise<string | null> {
  try {
    return getAgentSigner().address;
  } catch {
    return null;
  }
}

/**
 * LIVE mode — AGENT_PRIVATE_KEY is set.
 * The agent signs both the approval and the Textile swap transaction on its own.
 * The agent wallet must hold enough USDT/USDC and CELO (gas).
 */
export function isLiveMode(): boolean {
  return !!process.env.AGENT_PRIVATE_KEY;
}

/**
 * ASSISTED mode — no AGENT_PRIVATE_KEY.
 * Backend returns unsigned Textile transactions; client's wallet signs them.
 * No custom contract needed — Textile delivers cNGN directly to the freelancer.
 */
export function isAssistedMode(): boolean {
  return !isLiveMode();
}

/** Returns a string label for the current execution mode */
export function executionMode(): "live" | "assisted" | "simulation" {
  if (isLiveMode()) return "live";
  // simulation = assisted mode but Textile API key is also missing
  if (!process.env.TEXTILE_API_KEY) return "simulation";
  return "assisted";
}
