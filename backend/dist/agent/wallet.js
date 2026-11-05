"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = getProvider;
exports.getAgentSigner = getAgentSigner;
exports.getAgentAddress = getAgentAddress;
exports.isLiveMode = isLiveMode;
exports.isAssistedMode = isAssistedMode;
exports.executionMode = executionMode;
/**
 * Agent wallet — manages the Cobro Agent's own Celo EOA.
 *
 * LIVE mode      = AGENT_PRIVATE_KEY set → agent signs both Textile txns autonomously
 * ASSISTED mode  = no AGENT_PRIVATE_KEY  → backend returns unsigned txns, client's
 *                  MetaMask signs and broadcasts them
 * SIMULATION mode = no key, no Textile API key → returns fake txHash (dev/demo)
 */
const ethers_1 = require("ethers");
const celo_1 = require("../config/celo");
/** Lazy singleton provider connected to Celo */
let _provider = null;
function getProvider() {
    if (!_provider) {
        _provider = new ethers_1.ethers.JsonRpcProvider(celo_1.CELO_CONFIG.rpcUrl);
    }
    return _provider;
}
/**
 * Returns the agent's signer connected to Celo.
 * Throws if AGENT_PRIVATE_KEY is not set — caller must check isLiveMode() first.
 */
function getAgentSigner() {
    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("AGENT_PRIVATE_KEY is not configured. " +
            "Set it in backend/.env to enable live on-chain execution.");
    }
    return new ethers_1.ethers.Wallet(privateKey, getProvider());
}
/** Returns the agent's public address, or null in simulation/assisted mode */
async function getAgentAddress() {
    try {
        return getAgentSigner().address;
    }
    catch {
        return null;
    }
}
/**
 * LIVE mode — AGENT_PRIVATE_KEY is set.
 * The agent signs both the approval and the Textile swap transaction on its own.
 * The agent wallet must hold enough USDT/USDC and CELO (gas).
 */
function isLiveMode() {
    return !!process.env.AGENT_PRIVATE_KEY;
}
/**
 * ASSISTED mode — no AGENT_PRIVATE_KEY.
 * Backend returns unsigned Textile transactions; client's wallet signs them.
 * No custom contract needed — Textile delivers cNGN directly to the freelancer.
 */
function isAssistedMode() {
    return !isLiveMode();
}
/** Returns a string label for the current execution mode */
function executionMode() {
    if (isLiveMode())
        return "live";
    // simulation = assisted mode but Textile API key is also missing
    if (!process.env.TEXTILE_API_KEY)
        return "simulation";
    return "assisted";
}
