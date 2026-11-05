"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = getProvider;
exports.getAgentSigner = getAgentSigner;
exports.getAgentAddress = getAgentAddress;
exports.executionMode = executionMode;
/**
 * Agent identity helpers. Invoice payments are client-authorized: the backend
 * prepares transactions and the client wallet signs and pays Celo gas.
 * AGENT_PRIVATE_KEY is optional and reserved for deployment/admin operations.
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
 * Returns the optional admin/deployer signer connected to Celo.
 */
function getAgentSigner() {
    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("AGENT_PRIVATE_KEY is not configured. " +
            "Set it in backend/.env to enable live on-chain execution.");
    }
    return new ethers_1.ethers.Wallet(privateKey, getProvider());
}
/** Returns the optional admin wallet address. */
async function getAgentAddress() {
    try {
        return getAgentSigner().address;
    }
    catch {
        return null;
    }
}
/** Returns the payment execution mode exposed by the API. */
function executionMode() {
    return process.env.TEXTILE_API_KEY ? "assisted" : "unavailable";
}
