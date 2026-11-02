import { http, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// WalletConnect Cloud Project ID (default or user-configured)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64";

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: "Cobro Invoicing",
        description: "Freelance Invoicing & Textile FX Settlement on Celo",
        url: "https://cobro.app",
        icons: ["https://cobro.app/icon.png"],
      },
      showQrModal: true,
    }),
    injected({
      target: "metaMask",
    }),
    injected(),
  ],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
});
