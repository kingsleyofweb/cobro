"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CELO_CONFIG = void 0;
/**
 * Celo Mainnet configuration for the Cobro backend agent.
 * Mirrors the frontend's celo.ts config so both sides stay in sync.
 */
exports.CELO_CONFIG = {
    chainId: 42220,
    name: "Celo Mainnet",
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
    /** Textile FX & Uniswap protocol contracts on Celo */
    contracts: {
        limitOrderReactor: "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3",
        permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        /** Set via COBRO_ROUTER_ADDRESS env var after deploying CobroInvoiceRouter.sol */
        cobroRouter: process.env.COBRO_ROUTER_ADDRESS || "",
    },
    /** Textile protocol fee: 1 bps (0.01%) */
    takerFeeBps: 1,
    /** Supported stablecoins on Celo Mainnet */
    tokens: {
        USDT: {
            symbol: "USDT",
            name: "Tether USD",
            address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
            decimals: 6,
        },
        USDC: {
            symbol: "USDC",
            name: "USD Coin (Native)",
            address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
            decimals: 6,
        },
        cNGN: {
            symbol: "cNGN",
            name: "Compliant Nigerian Naira",
            address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
            decimals: 6,
        },
        wARS: {
            symbol: "wARS",
            name: "Wrapped Argentine Peso",
            address: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D",
            decimals: 18,
        },
        wBRL: {
            symbol: "wBRL",
            name: "Wrapped Brazilian Real",
            address: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0",
            decimals: 18,
        },
    },
};
