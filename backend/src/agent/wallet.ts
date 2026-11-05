/**
 * Agent identity helpers. Invoice payments are client-authorized: the backend
 * prepares transactions and the client wallet signs and pays Celo gas.
 * AGENT_PRIVATE_KEY is optional and reserved for deployment/admin operations.
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
 * Returns the optional admin/deployer signer connected to Celo.
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

/** Returns the optional admin wallet address. */
export async function getAgentAddress(): Promise<string | null> {
  try {
    return getAgentSigner().address;
  } catch {
    return null;
  }
}

/** Returns the payment execution mode exposed by the API. */
export function executionMode(): "assisted" | "unavailable" {
  return process.env.TEXTILE_API_KEY ? "assisted" : "unavailable";
}
