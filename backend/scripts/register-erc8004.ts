import "dotenv/config";
import { ethers } from "ethers";

// Celo mainnet ERC-8004 Identity Registry. Verify this address against the
// current hackathon instructions before broadcasting a transaction.
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const CELO_CHAIN_ID = 42220;

const REGISTRY_ABI = [
  "function register() external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string calldata newURI) external",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function makeRegistration(
  agentId: string,
  webEndpoint: string,
  apiEndpoint: string,
  wallet: string,
) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Cobro Payment Agent",
    description:
      "A Celo payment agent that compares USDC and USDT routes, converts stablecoins through Textile FX, pays freelance invoices in cNGN, and refunds unused funds.",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect width='256' height='256' rx='48' fill='%2335d07f'/%3E%3Ctext x='128' y='155' text-anchor='middle' font-size='112' font-family='sans-serif' fill='white'%3EC%3C/text%3E%3C/svg%3E",
    services: [
      { name: "web", endpoint: webEndpoint },
      { name: "agent-api", endpoint: `${apiEndpoint.replace(/\/$/, "")}/api/agent` },
    ],
    x402Support: false,
    active: true,
    registrations: [
      {
        agentId: Number(agentId),
        agentRegistry: `eip155:${CELO_CHAIN_ID}:${IDENTITY_REGISTRY}`,
      },
    ],
    supportedTrust: ["reputation"],
    agentWallet: wallet,
  };
}

async function main() {
  const privateKey = required("AGENT_PRIVATE_KEY");
  const webEndpoint = required("AGENT_PUBLIC_URL");
  const apiEndpoint = process.env.AGENT_API_URL || webEndpoint;
  const provider = new ethers.JsonRpcProvider(
    process.env.CELO_RPC_URL || "https://forno.celo.org",
    CELO_CHAIN_ID,
  );
  const signer = new ethers.Wallet(privateKey, provider);
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, signer);

  console.log(`Registering Cobro from ${signer.address} on Celo mainnet...`);
  const registerTx = await registry.register();
  const registerReceipt = await registerTx.wait();
  if (!registerReceipt) throw new Error("Registration transaction was not mined");

  let agentId: bigint | undefined;
  for (const log of registerReceipt.logs) {
    try {
      const parsed = registry.interface.parseLog(log);
      if (parsed?.name === "Registered") {
        agentId = parsed.args.agentId as bigint;
        break;
      }
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }
  if (agentId === undefined) {
    throw new Error("Could not find agentId in the Registered event");
  }

  const registration = makeRegistration(
    agentId.toString(),
    webEndpoint,
    apiEndpoint,
    signer.address,
  );
  const registrationJson = JSON.stringify(registration);
  const agentURI = `data:application/json;base64,${Buffer.from(registrationJson).toString("base64")}`;

  console.log(`Registered agentId: ${agentId}`);
  console.log(`Setting on-chain registration URI...`);
  const uriTx = await registry.setAgentURI(agentId, agentURI);
  const uriReceipt = await uriTx.wait();
  if (!uriReceipt) throw new Error("Agent URI transaction was not mined");

  console.log("\nERC-8004 registration complete:");
  console.log(`agentId: ${agentId}`);
  console.log(`agentRegistry: eip155:${CELO_CHAIN_ID}:${IDENTITY_REGISTRY}`);
  console.log(`owner/agentWallet: ${signer.address}`);
  console.log(`registerTx: ${registerTx.hash}`);
  console.log(`setAgentURI Tx: ${uriTx.hash}`);
  console.log(`agentURI: ${agentURI}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
