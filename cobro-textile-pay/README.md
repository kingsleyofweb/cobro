# Cobro Invoice Pay — Textile FX Integration on Celo

This project demonstrates the end-to-end integration of **Textile FX on Celo (Chain ID: `42220`)** for **Cobro**, enabling clients to pay freelance invoices in their choice of stablecoin (USDT or USDC) while guaranteeing that the freelancer receives the exact billed amount in their local currency (e.g., `cNGN`) in a single non-custodial, atomic flow.

---

## 1. Quickstart (Instant Demo)

To test and showcase the Textile FX integration in seconds:

### Option A: Local Web Server (Recommended for Browser Extensions)
Running via local HTTP allows browser extensions like **MetaMask**, **Rabby**, and **Coinbase Wallet** to inject automatically without file permission restrictions:
1. Double-click `start-server.bat` or run in PowerShell:
   ```powershell
   cd "C:\Users\Zoe's Koncept\.gemini\antigravity\scratch\cobro-textile-pay"
   .\start-server.ps1
   ```
2. Your browser will automatically open [http://localhost:8080](http://localhost:8080) with your installed browser wallet detected and ready to connect!

### Option B: Direct File Open
Open `index.html` directly in any web browser:
```powershell
Start-Process "C:\Users\Zoe's Koncept\.gemini\antigravity\scratch\cobro-textile-pay\index.html"
```
*Note: If Chrome/Edge blocks extensions on `file://`, use the built-in **"Instant In-Browser Celo Wallet"** (requires zero extensions) or run `start-server.bat` above.*

---

## 2. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Blockchain** | **Celo Mainnet (`42220`)** | Fast settlement (<5s), sub-cent gas fees, native local stablecoins (`cNGN`). |
| **FX & Liquidity Engine** | **Textile FX v2 RFQ** | Non-custodial RFQ network connecting private market makers for tight FX spreads. |
| **Settlement Protocol** | **UniswapX `LimitOrderReactor` v2.1.0** | Textile-operated reactor contract (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`). |
| **Permissions** | **Canonical Permit2** | Singleton at `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| **Smart Contract** | **`CobroInvoiceRouter.sol` (Solidity 0.8.20)** | Atomic routing contract ensuring the swapped cNGN goes directly to the freelancer. |
| **Frontend Framework** | **Next.js 14 (App Router) + TypeScript** | Production application with server-side API proxy routes. |
| **Web3 Client** | **Viem / Wagmi + Ethers.js** | Wallet connections (MetaMask, Celo MiniPay, Safe), transaction signing. |
| **Styling** | **Tailwind CSS + Lucide Icons** | Clean, responsive UI with real-time countdown progress visualization. |

---

## 3. Project File Structure

```text
cobro-textile-pay/
├── index.html                     <-- Zero-dependency instant browser app with EIP-6963 wallet auto-detection
├── start-server.bat               <-- 1-click Windows launcher (starts local web server on port 8080)
├── start-server.ps1               <-- PowerShell lightweight HTTP server
├── package.json                   <-- Next.js, Wagmi, Viem dependencies
├── tsconfig.json                  <-- TypeScript configuration
├── tailwind.config.js             <-- Tailwind styles & Celo color theme
├── postcss.config.js
├── README.md                      <-- Documentation & integration guide
│
├── contracts/                     <-- On-chain settlement contracts
│   ├── CobroInvoiceRouter.sol     <-- Atomic 1-click invoice payment router
│   └── interfaces/
│       ├── IERC20.sol             <-- ERC-20 token interface
│       ├── ILimitOrderReactor.sol <-- Textile UniswapX reactor interface
│       └── IPermit2.sol           <-- Canonical Uniswap Permit2 interface
│
└── src/
    ├── config/
    │   └── celo.ts                <-- Celo addresses (Reactor, Permit2, cNGN, USDT, USDC)
    ├── services/
    │   └── textileRfq.ts          <-- Textile FX RFQ SDK (Preview, Request, Submit, Status)
    ├── hooks/
    │   └── useTextileQuote.ts     <-- React hook with 60s TTL countdown & auto-refresh
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx               <-- Next.js Cobro Invoice Checkout interface
    │   └── api/
    │       └── rfq/
    │           ├── preview/route.ts  <-- Next.js server proxy for /v2/rfq/preview
    │           └── request/route.ts  <-- Next.js server proxy with API key injection
```

---

## 4. Key Textile FX Architectural Mechanics

### A. Exact-Output RFQ (`buyAmount`)
In standard swaps, users input `sellAmount`. For invoice fulfillment, the invoice demands an exact sum in `buyToken` (e.g., `500,000 cNGN`). We pass `buyAmount` in atomic units (`500000000000`) and leave `sellAmount` empty. Textile's online makers calculate the exact required input (e.g., `331.42 USDT`), incorporating the 1 bps protocol fee.

### B. The 60-Second TTL Window
Textile quotes are cryptographically signed orders valid for approximately 60 seconds. Our UI features a live progress bar. If the quote reaches &le;10 seconds, it automatically re-solicits a firm quote to prevent on-chain deadline reverts.

### C. Direct Payout via `CobroInvoiceRouter.sol`
Standard `LimitOrderReactor.execute(...)` delivers the purchased tokens to `msg.sender`. If the client executes the trade, the cNGN lands in the client's wallet. 

`CobroInvoiceRouter.sol` bridges this atomically:
1. Client calls `CobroInvoiceRouter.payInvoiceWithTextileSwap(...)`.
2. Router pulls USDT from client and executes Textile's swap on `LimitOrderReactor`.
3. Router receives cNGN and forwards it to `freelancer` in the same call.
4. If the swap fails or under-fills, the entire transaction reverts.

---

## 5. End-to-End User Journeys

### A. Freelancer Journey
1. **Login as Freelancer**: Select role from the main screen.
2. **Add Invoice**: Click the **"+ Add Invoice"** button to open the invoice modal.
3. **Form Details**: Fill in the Client Name, Wallet Address, Amount (cNGN), Service Scope, and Due Date.
4. **Generate Invoice**: Click **"Generate Invoice"** — the invoice is cryptographically signed and immediately registered in state.
5. **Logout**: Return to the role switcher anytime with the dedicated **Logout** button.

### B. Client Journey
1. **Login as Client**: Select the Client role to view all pending invoices.
2. **Connect Wallet (WalletConnect)**:
   * Open the **WalletConnect** modal.
   * Scan the live QR code with mobile wallets (**Valora**, **Celo MiniPay**, **Rainbow**, **MetaMask**), use the **"Open Valora / MiniPay"** deep link, or copy the `wc:` URI.
   * Or connect an injected browser wallet (MetaMask) or click **"Simulate WalletConnect Session"** for zero-friction testing.
3. **Select Invoice & Currency**: Pick the invoice to fulfill and select **USDT** or **USDC**.
4. **Textile FX Quotation**: The client receives a firm 60-second exact-output quote from Textile's maker network.
5. **Pay & Fulfill**: Execute the atomic swap on Celo's `LimitOrderReactor`. The freelancer receives the exact cNGN instantly.
6. **Receipt**: View and print the on-chain receipt with Celoscan transaction hash.
7. **Logout**: Exit securely with the **Logout** button.

---

## 6. Running the Next.js Production Build

Once Node.js is installed on your machine:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
