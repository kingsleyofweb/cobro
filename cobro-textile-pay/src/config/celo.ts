export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoUrl?: string;
}

/**
 * Active chain config — controlled by NEXT_PUBLIC_CELO_TESTNET env var.
 *
 * TESTNET (Celo Alfajores, chainId 44787):
 *   - Use when you have faucet CELO & USDC on Celo Sepolia / Alfajores
 *   - Textile FX rate quotes still come from Celo Mainnet (live market data)
 *   - Settlement is simulated (Textile doesn't settle on Alfajores yet)
 *   - Explorer: alfajores.celoscan.io  |  Faucet: faucet.celo.org
 *
 * MAINNET (Celo, chainId 42220):
 *   - Use in production with real USDT and a Textile production API key
 *   - Full real on-chain settlement via Textile LimitOrderReactor
 */
const IS_TESTNET = process.env.NEXT_PUBLIC_CELO_TESTNET === "true";
// Allow overriding chain ID via env — Celo Sepolia = 44787, Alfajores = 44787 (same network)
const TESTNET_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CELO_CHAIN_ID || "44787");

export const CELO_CHAIN_CONFIG = IS_TESTNET
  ? {
      chainId: TESTNET_CHAIN_ID,
      name: "Celo Sepolia",
      currency: "CELO",
      rpcUrl: "https://alfajores-forno.celo-testnet.org",
      explorerUrl: "https://alfajores.celoscan.io",
      isTestnet: true,

      contracts: {
        limitOrderReactor: "0x0000000000000000000000000000000000000000", // not deployed on testnet
        permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        feeController: "0x0000000000000000000000000000000000000000",
      },

      takerFeeBps: 1,

      // Celo Alfajores testnet token addresses
      tokens: {
        USDT: {
          symbol: "USDT",
          name: "Tether USD (testnet)",
          // Circle's testnet USDC on Alfajores — used as stand-in for USDT in demo
          address: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
          decimals: 6,
        } as TokenInfo,
        USDC: {
          symbol: "USDC",
          name: "USD Coin (testnet)",
          address: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
          decimals: 6,
        } as TokenInfo,
        cNGN: {
          symbol: "cNGN",
          name: "Compliant Nigerian Naira (testnet)",
          address: "0x0000000000000000000000000000000000000000", // testnet placeholder
          decimals: 6,
        } as TokenInfo,
        wARS: {
          symbol: "wARS",
          name: "Wrapped Argentine Peso",
          address: "0x0000000000000000000000000000000000000000",
          decimals: 18,
        } as TokenInfo,
        wBRL: {
          symbol: "wBRL",
          name: "Wrapped Brazilian Real",
          address: "0x0000000000000000000000000000000000000000",
          decimals: 18,
        } as TokenInfo,
      },
    }
  : {
      // ── Celo Mainnet ────────────────────────────────────────────────────
      chainId: 42220,
      name: "Celo Mainnet",
      currency: "CELO",
      rpcUrl: "https://forno.celo.org",
      explorerUrl: "https://celoscan.io",
      isTestnet: false,

      contracts: {
        limitOrderReactor: "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3",
        permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        feeController: "0x0000000000000000000000000000000000000000",
      },

      takerFeeBps: 1,

      tokens: {
        USDT: {
          symbol: "USDT",
          name: "Tether USD",
          address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
          decimals: 6,
        } as TokenInfo,
        USDC: {
          symbol: "USDC",
          name: "USD Coin (Native)",
          address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
          decimals: 6,
        } as TokenInfo,
        cNGN: {
          symbol: "cNGN",
          name: "Compliant Nigerian Naira",
          address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
          decimals: 6,
        } as TokenInfo,
        wARS: {
          symbol: "wARS",
          name: "Wrapped Argentine Peso",
          address: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D",
          decimals: 18,
        } as TokenInfo,
        wBRL: {
          symbol: "wBRL",
          name: "Wrapped Brazilian Real",
          address: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0",
          decimals: 18,
        } as TokenInfo,
      },
    };
