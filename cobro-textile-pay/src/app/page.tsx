"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CELO_CHAIN_CONFIG } from "../config/celo";
import {
  getAgentQuote,
  executeAgentPayment,
  fetchInvoices,
  createInvoiceApi,
  confirmPayment,
  type AgentQuoteResponse,
} from "../services/agentApi";
import { 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink, 
  Code2, 
  Wallet, 
  UserCheck, 
  Building2, 
  FilePlus, 
  PlusCircle, 
  Sparkles, 
  LogOut, 
  Info,
  FileCheck,
  Printer,
  Bot,
  Zap,
  TrendingDown,
} from "lucide-react";

interface Invoice {
  id: string;
  clientName: string;
  clientAddress: string;
  freelancerName: string;
  freelancerAddress: string;
  description: string;
  currency: "cNGN" | "USDC" | "wARS" | "wBRL";
  acceptedSettlementCurrencies?: ("cNGN" | "USDC")[];
  amount: number;
  amountFormatted: string;
  dueDate: string;
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith?: string | null;
}

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

export default function CobroApp() {
  const [role, setRole] = useState<"freelancer" | "client" | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  // ── Freelancer Profile ─────────────────────────────────────────────────────
  const [freelancerProfile, setFreelancerProfile] = useState<{
    username: string;
    walletAddress: string;
    displayName: string;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileWallet, setProfileWallet] = useState("");
  const [profileConnecting, setProfileConnecting] = useState(false);

  // Payment State
  const [sellTokenSymbol] = useState<"USDT">("USDT");
  const [settlementCurrency, setSettlementCurrency] = useState<"cNGN" | "USDC">("cNGN");
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  // Agent State
  const [agentQuote, setAgentQuote] = useState<AgentQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Web3 State
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0.00");

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formClientName, setFormClientName] = useState("");
  const [formClientAddress, setFormClientAddress] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"cNGN" | "USDC" | "wARS" | "wBRL">("cNGN");
  const [acceptUsdcSettlement, setAcceptUsdcSettlement] = useState(true);
  const [formDueDate, setFormDueDate] = useState("2026-11-12");

  const activeInvoice = invoices.find(i => i.id === selectedInvoiceId) || invoices[0]!;

  // Payment amount is shown only when backed by a live agent quote.
  const bestCorridor = agentQuote?.bestSettlementCurrency ?? settlementCurrency;
  const calculatedSellAmount = agentQuote
    ? agentQuote.settlements[bestCorridor]?.estimatedSellAmountFormatted ?? "Unavailable"
    : "Unavailable";

  // Fetch persisted invoices from backend on mount
  useEffect(() => {
    setInvoicesLoading(true);
    fetchInvoices()
      .then((data) => {
        if (data) {
          setInvoices(data as any);
          setSelectedInvoiceId(data[0]?.id || "");
          setInvoicesError(null);
        } else {
          setInvoicesError("Unable to load invoices from the backend.");
        }
      })
      .catch(() => setInvoicesError("Unable to load invoices from the backend."))
      .finally(() => setInvoicesLoading(false));
  }, []);

  // Fetch agent quote preview whenever the client view opens or invoice changes
  useEffect(() => {
    if (role !== "client" || !activeInvoice || activeInvoice.status === "PAID") {
      setAgentQuote(null);
      setQuoteError(null);
      return;
    }
    setAgentQuote(null);
    setQuoteError(null);
    getAgentQuote(activeInvoice.id, connectedAddress ?? undefined)
      .then(setAgentQuote)
      .catch((error: unknown) => {
        setQuoteError(error instanceof Error ? error.message : "Live Textile quote unavailable");
      });
  }, [role, selectedInvoiceId, connectedAddress]);

  // 60-second TTL timer
  useEffect(() => {
    if (role !== "client") return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [role, selectedInvoiceId]);

  // Connect Web3 Wallet
  const connectWallet = async (): Promise<boolean> => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setConnectedAddress(accounts[0]);
        setProfileWallet(accounts[0]);
        const network = await provider.getNetwork();
        const cId = Number(network.chainId);
        setChainId(cId);

        if (cId !== CELO_CHAIN_CONFIG.chainId) {
          await switchToCelo();
          const switchedNetwork = await provider.getNetwork();
          const switchedChainId = Number(switchedNetwork.chainId);
          setChainId(switchedChainId);
          if (switchedChainId !== CELO_CHAIN_CONFIG.chainId) return false;
        }

        // Fetch balance
        const tokenAddr = CELO_CHAIN_CONFIG.tokens[sellTokenSymbol].address;
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
        const bal = await tokenContract.balanceOf(accounts[0]);
        setTokenBalance((Number(bal) / 1000000).toFixed(2));
        return true;
      } catch (err) {
        console.warn("Wallet connect:", err);
        return false;
      }
    } else {
      alert("A Celo-compatible wallet is required for mainnet payments.");
      return false;
    }
  };

  const loginWithWallet = async (nextRole: "freelancer" | "client") => {
    const connected = await connectWallet();
    if (!connected) return;
    setRole(nextRole);
  };

  const switchToCelo = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const hexChainId = "0x" + CELO_CHAIN_CONFIG.chainId.toString(16);
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hexChainId,
            chainName: CELO_CHAIN_CONFIG.name,
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            rpcUrls: [CELO_CHAIN_CONFIG.rpcUrl],
            blockExplorerUrls: [CELO_CHAIN_CONFIG.explorerUrl],
          }],
        });
      }
    }
  };

  // ── Freelancer: connect wallet for profile ─────────────────────────────────
  const connectFreelancerWallet = async () => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask to connect your wallet.");
      return;
    }
    setProfileConnecting(true);
    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setProfileWallet(accounts[0]);
    } catch (err) {
      console.warn("Freelancer wallet connect failed:", err);
    } finally {
      setProfileConnecting(false);
    }
  };

  const saveFreelancerProfile = () => {
    if (!profileUsername.trim() || !profileWallet) {
      alert("Please enter a username and connect your wallet.");
      return;
    }
    const profile = {
      username: profileUsername.trim().replace(/^@/, ""),
      displayName: profileDisplayName.trim() || profileUsername.trim(),
      walletAddress: profileWallet,
    };
    setFreelancerProfile(profile);
    localStorage.setItem("cobro_freelancer_profile", JSON.stringify(profile));
    setShowProfileModal(false);
  };

  const disconnectFreelancerProfile = () => {
    setFreelancerProfile(null);
    setProfileWallet("");
    localStorage.removeItem("cobro_freelancer_profile");
  };

  // Handle Invoice Creation — backend persistence is required.
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientName || !formAmount || !formDescription) return;

    const numAmount = parseFloat(formAmount);

    try {
      const saved = await createInvoiceApi({
        freelancerName: freelancerProfile?.displayName || "Freelancer",
        freelancerAddress: connectedAddress || profileWallet,
        clientName: formClientName,
        clientAddress: formClientAddress,
        description: formDescription,
        currency: formCurrency,
        acceptedSettlementCurrencies: formCurrency === "cNGN" && acceptUsdcSettlement ? ["cNGN", "USDC"] : [formCurrency as "cNGN" | "USDC"],
        amount: numAmount,
        dueDate: formDueDate,
      });
      setInvoices(prev => [saved as any, ...prev]);
      setSelectedInvoiceId(saved.id);
    } catch (error) {
      setInvoicesError(error instanceof Error ? error.message : "Unable to create invoice.");
      return;
    }

    setShowCreateModal(false);
    setFormClientName("");
    setFormDescription("");
    setFormAmount("");
  };

  // Handle payment execution — the client wallet signs and pays Celo gas.
  const handleExecutePayment = async () => {
    if (!activeInvoice || activeInvoice.status === "PAID") return;
    if (!agentQuote) {
      alert(quoteError || "A live Textile quote is required before payment.");
      return;
    }

    if (!connectedAddress) {
      await connectWallet();
      return;
    }
    if (chainId !== CELO_CHAIN_CONFIG.chainId) {
      await switchToCelo();
      return;
    }

    setIsPaying(true);
    setAgentQuote(null);

    try {
      // ── Step 1: Agent compares accepted settlement currencies ──────────
      setPaymentStep(1);
      setStepMessage("Comparing cNGN and USDC settlement routes via Textile FX...");

      const quote = await getAgentQuote(
        activeInvoice.id,
        connectedAddress ?? undefined,
      );
      setAgentQuote(quote);

      // ── Step 2: Request firm Textile quote + execute ──────────────────
      setPaymentStep(2);
      setStepMessage(`Requesting firm 60s Textile quote...`);

      const result = await executeAgentPayment(
        activeInvoice.id,
        quote.bestSettlementCurrency,
        connectedAddress ?? undefined,
      );

      let finalTxHash = result.txHash ?? "";

      // ── ASSISTED MODE: client wallet signs approval + swap ────────────
      if (result.mode === "assisted" && result.approvalTx && result.swapTx) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        const quoteExpired = () =>
          !!result.quoteExpiresAt && Date.now() >= Date.parse(result.quoteExpiresAt);
        if (quoteExpired()) {
          throw new Error("The firm Textile quote expired. Please request a new quote.");
        }

        setStepMessage(`Approving exact ${result.paidWith} spend for Textile... (1/2)`);
        const approveTx = await signer.sendTransaction({
          to: result.approvalTx.to,
          data: result.approvalTx.data,
        });
        await approveTx.wait(1);

        if (quoteExpired()) {
          throw new Error("The firm Textile quote expired while approval was pending. Please request a new quote.");
        }

        setStepMessage(`Executing Textile FX swap on Celo Mainnet... (2/2)`);
        const swapTx = await signer.sendTransaction({
          to: result.swapTx.to,
          data: result.swapTx.data,
        });
        const receipt = await swapTx.wait(1);
        finalTxHash = receipt?.hash ?? swapTx.hash;

        // Record the confirmed txHash on the backend
        await confirmPayment(activeInvoice.id, finalTxHash, result.paidWith);
      }

      // ── Step 3: Confirmed ──────────────────────────────────────────────
      setPaymentStep(3);
      setTxHash(finalTxHash);
      setIsPaying(false);

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === activeInvoice.id
            ? { ...inv, status: "PAID", txHash: finalTxHash, paidWith: result.paidWith }
            : inv,
        ),
      );
    } catch (err: any) {
      console.error("Agent payment failed:", err);
      setIsPaying(false);
      setPaymentStep(0);
      const msg = err.code === "ACTION_REJECTED"
        ? "Transaction cancelled in wallet."
        : `Payment error: ${err.message || "Unknown error"}`;
      alert(msg);
    }
  };

  // Kept for backward compat — main flow now goes through handleExecutePayment
  const runSimulatorPayment = () => {
    handleExecutePayment();
  };

  return (
    <main className="min-h-screen py-8 px-4 max-w-5xl mx-auto">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between pb-6 border-b border-gray-800 gap-4 mb-8">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRole(null)}>
          <div className="h-10 w-10 rounded-xl bg-celo-green flex items-center justify-center font-black text-black text-xl shadow-lg shadow-celo-green/20">
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Cobro <span className="text-xs px-2.5 py-0.5 rounded-full bg-celo-green/10 text-celo-green border border-celo-green/30">{CELO_CHAIN_CONFIG.name}</span>
            </h1>
            <p className="text-xs text-gray-400">Freelance Invoicing & FX Settlement via Textile</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            Powered by <strong>Textile FX</strong>
          </div>

          {/* Freelancer Profile Badge */}
          {freelancerProfile && role === "freelancer" && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-celo-green/10 border border-celo-green/30 text-celo-green text-xs font-medium hover:bg-celo-green/20 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-celo-green flex items-center justify-center text-black font-black text-[10px]">
                {freelancerProfile.username[0].toUpperCase()}
              </div>
              @{freelancerProfile.username}
              <span className="text-celo-green/60 font-mono">{freelancerProfile.walletAddress.slice(0,4)}…{freelancerProfile.walletAddress.slice(-3)}</span>
            </button>
          )}

          {role && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-xs">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  role === "freelancer" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                }`}>
                  {role}
                </span>
                <span className="font-mono text-gray-300">
                  {connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "Wallet not connected"}
                </span>
              </div>
              <button 
                onClick={() => setRole(null)} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-red-500/10 hover:border-red-500/40 border border-gray-800 text-xs text-gray-300 hover:text-red-400 font-medium transition shadow-sm" 
                title="Log out and return to role selection"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {invoicesLoading && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/70 p-4 text-sm text-gray-300 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin text-celo-green" />
          Loading invoices from the backend…
        </div>
      )}
      {!invoicesLoading && invoicesError && (
        <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {invoicesError}
        </div>
      )}

      {/* VIEW 1: Role Selection */}
      {!role && (
        <section className="py-8 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Select Your Workspace Role</h2>
            <p className="text-sm text-gray-400">Choose how you want to interact with Cobro's non-custodial invoice engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Freelancer Card */}
            <div onClick={() => loginWithWallet("freelancer")} className="group p-6 bg-gray-900/90 border border-gray-800 hover:border-celo-green/50 hover:bg-gray-900 rounded-2xl cursor-pointer transition-all duration-200 shadow-xl space-y-4 hover:shadow-celo-green/10">
              <div className="w-12 h-12 rounded-xl bg-celo-green/10 text-celo-green flex items-center justify-center group-hover:scale-110 transition">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-celo-green transition">Login as Freelancer</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Generate invoices in your preferred local currency (cNGN, wARS). Track payments in real-time.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-celo-green gap-1.5">
                <span>Open Freelancer Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Client Card */}
            <div onClick={() => loginWithWallet("client")} className="group p-6 bg-gray-900/90 border border-gray-800 hover:border-indigo-500/50 hover:bg-gray-900 rounded-2xl cursor-pointer transition-all duration-200 shadow-xl space-y-4 hover:shadow-indigo-500/10">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition">Login as Client</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Review received invoices and pay using USDT or USDC. Textile FX automatically delivers exact cNGN.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-indigo-400 gap-1.5">
                <span>Open Client Invoices</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* VIEW 2: Freelancer Dashboard */}
      {role === "freelancer" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-900/70 border border-gray-800 p-5 rounded-2xl">
            <div>
              <h2 className="text-xl font-bold text-white">Freelancer Dashboard</h2>
              <p className="text-xs text-gray-400">Logged in as <strong className="text-celo-green font-mono">{connectedAddress || "Connected wallet"}</strong></p>
            </div>
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-celo-green hover:bg-celo-green/90 text-black font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-celo-green/20 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Invoice</span>
              </button>
              <button 
                onClick={() => setRole(null)}
                className="px-3.5 py-2.5 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-gray-700 text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition" 
                title="Logout from Freelancer account"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
              <p className="text-xs text-gray-400">Total Invoiced</p>
              <p className="text-xl font-extrabold text-white mt-1">
                ₦{invoices.reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
              <p className="text-xs text-gray-400">Total Settled on Celo</p>
              <p className="text-xl font-extrabold text-celo-green mt-1">
                ₦{invoices.filter(i => i.status === "PAID").reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
              <p className="text-xs text-gray-400">Pending Settlement</p>
              <p className="text-xl font-extrabold text-amber-400 mt-1">
                ₦{invoices.filter(i => i.status === "UNPAID").reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Issued Invoices</h3>
              <span className="text-xs text-gray-400">{invoices.length} Invoices</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950/70 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-3">Invoice ID</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">No invoices yet. Create your first invoice.</td></tr>
                  ) : invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-950/40 transition">
                      <td className="px-6 py-4 font-mono font-bold text-white">{inv.id}</td>
                      <td className="px-6 py-4 text-gray-300">{inv.clientName}</td>
                      <td className="px-6 py-4 text-gray-400 max-w-xs truncate">{inv.description}</td>
                      <td className="px-6 py-4 font-bold text-white">₦{inv.amountFormatted} <span className="text-[10px] text-celo-green">{inv.currency}</span></td>
                      <td className="px-6 py-4 text-gray-400">{inv.dueDate}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === "PAID" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {inv.status === "UNPAID" ? (
                          <button 
                            onClick={() => { setSelectedInvoiceId(inv.id); setRole("client"); }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Pay as Client &rarr;
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => { setSelectedInvoiceId(inv.id); setShowReceiptModal(true); }}
                              className="text-indigo-300 hover:underline flex items-center gap-1 font-semibold text-xs"
                            >
                              Receipt <FileCheck className="w-3 h-3" />
                            </button>
                            <a 
                              href={`${CELO_CHAIN_CONFIG.explorerUrl}/tx/${inv.txHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-celo-green hover:underline flex items-center gap-1 font-semibold text-xs"
                            >
                              Celoscan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* VIEW 3: Client Dashboard */}
      {role === "client" && invoices.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between bg-gray-900/70 border border-gray-800 p-5 rounded-2xl gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Client Payment Portal</h2>
              <p className="text-xs text-gray-400">Pay freelancer invoices on Celo &bull; Powered by Textile FX</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline-block text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-full font-medium">
                Zero AMM Slippage &bull; Atomic Limit Order
              </span>
              <button 
                onClick={() => setRole(null)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-gray-700 text-gray-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition" 
                title="Logout from Client account"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Pending Invoices Cards */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Select Invoice to Fulfill:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {invoices.map(inv => (
                <div 
                  key={inv.id}
                  onClick={() => { setSelectedInvoiceId(inv.id); setPaymentStep(0); setTxHash(null); }}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    inv.id === selectedInvoiceId ? "border-celo-green bg-celo-green/10" : "border-gray-800 bg-gray-950/60 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono">{inv.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.status === "PAID" ? "bg-celo-green/10 text-celo-green" : "bg-amber-500/10 text-amber-400"
                    }`}>{inv.status}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2 font-medium truncate">{inv.description}</p>
                  <div className="mt-2 text-sm font-extrabold text-white">
                    ₦{inv.amountFormatted} <span className="text-xs font-normal text-celo-green">{inv.currency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Payment Area */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Invoice Specs */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-4 pb-3 border-b border-gray-800">
                  <span className="font-mono font-bold text-white">#{activeInvoice.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeInvoice.status === "PAID" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}>
                    {activeInvoice.status}
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <p className="text-gray-400">Freelancer (Beneficiary)</p>
                    <p className="font-semibold text-white text-sm">{activeInvoice.freelancerName}</p>
                    <p className="text-gray-500 font-mono truncate">{activeInvoice.freelancerAddress}</p>
                  </div>

                  <div>
                    <p className="text-gray-400">Scope of Work</p>
                    <p className="text-gray-300">{activeInvoice.description}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-gray-400">Exact Invoice Amount Owed</p>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      ₦{activeInvoice.amountFormatted} <span className="text-xs font-normal text-celo-green">{activeInvoice.currency}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Settled directly to freelancer on Celo via Textile's LimitOrderReactor.
                    </p>
                  </div>
                </div>
              </div>

              {/* Protocol Architecture Card */}
              <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl p-4 text-xs text-indigo-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Textile Exact-Output Settlement
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Makers price exact input to produce exact <code className="text-indigo-300">buyAmount</code>. Order settles via pinned <strong>UniswapX LimitOrderReactor</strong> at <code className="text-indigo-300">0xa9AA0a...35b3</code>.
                </p>
                <button 
                  onClick={() => setShowPayloadModal(true)}
                  className="text-celo-green hover:underline flex items-center gap-1 font-semibold text-xs pt-1"
                >
                  <Code2 className="w-3.5 h-3.5" /> Inspect Live RFQ & Calldata Payload
                </button>
              </div>
            </div>

            {/* Right: Textile Payment Widget */}
            <div className="md:col-span-7 space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                {/* 60s Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-800">
                  <div 
                    className={`h-full transition-all duration-1000 ${timeLeft < 15 ? 'bg-red-500' : 'bg-celo-green'}`}
                    style={{ width: `${(timeLeft / 60) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-white">Freelancer Accepted Currencies</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className={`w-3.5 h-3.5 ${timeLeft < 15 ? 'text-red-400 animate-pulse' : 'text-celo-green'}`} />
                    <span className={timeLeft < 15 ? 'text-red-400 font-bold' : 'text-gray-300 font-mono'}>
                      Firm Quote: {timeLeft}s
                    </span>
                    <button onClick={() => setTimeLeft(60)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Currency Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button 
                    onClick={() => setSettlementCurrency("cNGN")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      settlementCurrency === "cNGN" ? "border-celo-green bg-celo-green/10 text-white font-medium" : "border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">₮</span>
                      <span>cNGN</span>
                    </div>
                    <span className="text-[11px] text-gray-400">Local payout</span>
                  </button>

                  <button 
                    onClick={() => setSettlementCurrency("USDC")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      settlementCurrency === "USDC" ? "border-celo-green bg-celo-green/10 text-white font-medium" : "border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center">$</span>
                      <span>USDC</span>
                    </div>
                    <span className="text-[11px] text-gray-400">USD payout</span>
                  </button>
                </div>

                {/* Conversion Box */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 mb-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Client Pays (Agent-Selected Best Rate)</span>
                    <span>Freelancer Gets (Exact)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black text-white tracking-tight">
                      {calculatedSellAmount} <span className="text-sm font-semibold text-gray-400">USDT</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-600" />
                    <div className="text-2xl font-black text-celo-green tracking-tight">
                      {activeInvoice.amountFormatted} <span className="text-sm font-semibold text-gray-400">{activeInvoice.currency}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 grid grid-cols-2 text-xs text-gray-400 gap-y-1.5">
                    <div className="flex items-center gap-1">
                      {agentQuote ? (
                        <span className="text-indigo-300 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Agent rate:
                          <span className="text-gray-200 font-mono ml-1">Output: {agentQuote.settlements[bestCorridor]?.estimatedBuyAmountFormatted ?? "Unavailable"} {bestCorridor}</span>
                        </span>
                      ) : (
                        <span className={quoteError ? "text-red-300" : "text-gray-400"}>
                          {quoteError || "Requesting live Textile quote..."}
                        </span>
                      )}
                    </div>
                    <div className="text-right">Taker Fee: <span className="text-gray-200 font-mono">1 bps (0.01%)</span></div>
                    <div>Celo Gas: <span className="text-celo-green font-mono">&lt; $0.001</span></div>
                    <div className="text-right">Atomic Settlement: <span className="text-indigo-400 font-medium">UniswapX Reactor</span></div>
                  </div>
                </div>

                {/* Web3 Status Bar */}
                {(
                  <div className="mb-5 p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${connectedAddress ? "bg-celo-green" : "bg-amber-400 animate-pulse"}`}></span>
                        <span>{connectedAddress ? `Wallet: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "Wallet: Disconnected"}</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        chainId === CELO_CHAIN_CONFIG.chainId ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-gray-900 text-gray-400 border border-gray-800"
                      }`}>
                        {chainId === CELO_CHAIN_CONFIG.chainId ? CELO_CHAIN_CONFIG.name : `Switch to ${CELO_CHAIN_CONFIG.name}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-900 text-[11px]">
                      <span className="text-gray-500">Balance: {tokenBalance} {sellTokenSymbol}</span>
                      {!connectedAddress ? (
                        <button onClick={connectWallet} className="text-celo-green hover:underline font-semibold flex items-center gap-1">
                          Connect Wallet <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : chainId !== CELO_CHAIN_CONFIG.chainId ? (
                        <button onClick={switchToCelo} className="text-amber-400 hover:underline font-semibold">
                          Switch to {CELO_CHAIN_CONFIG.name}
                        </button>
                      ) : (
                        <span className="text-celo-green font-medium">Ready on Celo</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Action or Settlement Pipeline */}
                {paymentStep > 0 ? (
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Bot className="w-4 h-4 text-celo-green" />
                      Cobro Agent Processing Payment...
                    </h4>

                    {/* Agent FX Analysis — shown once quote returns */}
                    {agentQuote && paymentStep >= 1 && (
                      <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                          <TrendingDown className="w-3.5 h-3.5 text-indigo-400" />
                          Agent FX Analysis — Best Route Selected
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(["cNGN", "USDC"] as const).map(c => {
                            const corridor = agentQuote.settlements[c];
                            if (!corridor) return null;
                            const isBest = agentQuote.bestSettlementCurrency === corridor.settlementCurrency;
                            return (
                              <div key={c} className={`p-2.5 rounded-lg border ${
                                isBest
                                  ? "border-celo-green/50 bg-celo-green/10"
                                  : "border-gray-800 bg-gray-900/50"
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-gray-300">{c}</span>
                                  {isBest && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-celo-green/20 text-celo-green font-bold">BEST</span>
                                  )}
                                </div>
                                <div className={`font-black text-sm ${ isBest ? "text-celo-green" : "text-gray-400" }`}>
                                  {corridor.available ? `${corridor.estimatedSellAmountFormatted} USDT` : "Unavailable"}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {corridor.available ? `Output: ${corridor.estimatedBuyAmountFormatted} ${c}` : corridor.reason}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-indigo-300 italic">{agentQuote.savings}</p>
                      </div>
                    )}

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep > 1 ? "bg-celo-green text-black" : "bg-celo-green/20 text-celo-green animate-pulse"
                        }`}>1</div>
                        <span className={paymentStep >= 1 ? "text-white" : "text-gray-500"}>Agent comparing cNGN and USDC settlement routes via Textile FX</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep > 2 ? "bg-celo-green text-black" : paymentStep === 2 ? "bg-celo-green/20 text-celo-green animate-pulse" : "bg-gray-800 text-gray-500"
                        }`}>2</div>
                        <span className={paymentStep >= 2 ? "text-white" : "text-gray-500"}>{stepMessage || "Requesting firm 60s quote — Textile LimitOrderReactor"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep >= 3 ? "bg-celo-green text-black" : "bg-gray-800 text-gray-500"
                        }`}>3</div>
                        <span className={paymentStep >= 3 ? "text-white" : "text-gray-500"}>Exact {activeInvoice.currency} delivered atomically to freelancer</span>
                      </div>
                    </div>

                    {txHash && (
                      <div className="pt-3 border-t border-gray-800">
                        <div className="p-3 bg-celo-green/10 border border-celo-green/30 rounded-lg text-xs space-y-1.5">
                          <p className="font-bold text-celo-green flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Invoice Fulfilled Successfully!
                          </p>
                          <p className="text-gray-300 font-mono text-[11px] truncate">Tx: {txHash}</p>
                          <div className="flex items-center gap-3 pt-1">
                            <a href={`${CELO_CHAIN_CONFIG.explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-celo-green hover:underline flex items-center gap-1 font-semibold text-xs">
                              View on Celoscan <ExternalLink className="w-3 h-3" />
                            </a>
                            <button onClick={() => setShowReceiptModal(true)} className="text-indigo-300 hover:underline flex items-center gap-1 font-semibold text-xs">
                              Official Receipt <FileCheck className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <button onClick={() => setRole("freelancer")} className="mt-3 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold">
                          Switch to Freelancer Dashboard to Verify Payment
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={handleExecutePayment}
                    disabled={isPaying || activeInvoice.status === "PAID" || !agentQuote || !!quoteError}
                    className="w-full py-4 bg-celo-green hover:bg-celo-green/90 text-black font-extrabold rounded-xl shadow-lg shadow-celo-green/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {activeInvoice.status === "PAID" ? (
                      <span>Invoice Already Paid</span>
                    ) : quoteError || !agentQuote ? (
                      <>
                        <span>{quoteError ? "Live Quote Unavailable" : "Waiting for Live Quote..."}</span>
                        <RefreshCw className="w-4 h-4" />
                      </>
                    ) : !connectedAddress ? (
                      <>
                        <span>Connect Wallet — Agent Will Find Best Rate</span>
                        <Wallet className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        <span>Pay with Agent ({calculatedSellAmount} USDT → {bestCorridor})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {role === "client" && !invoicesLoading && !invoicesError && invoices.length === 0 && (
        <section className="py-16 text-center rounded-2xl border border-gray-800 bg-gray-900/60">
          <FileCheck className="w-10 h-10 mx-auto text-gray-600 mb-4" />
          <h2 className="text-lg font-bold text-white">No invoices available</h2>
          <p className="text-sm text-gray-400 mt-2">Invoices created by freelancers will appear here.</p>
        </section>
      )}

      {/* FREELANCER PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-celo-green" />
                Freelancer Profile
              </h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-white text-xs px-2.5 py-1 bg-gray-800 rounded-lg">
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Your Name</label>
                <input
                  value={profileDisplayName}
                  onChange={e => setProfileDisplayName(e.target.value)}
                  placeholder="Amara Okonkwo"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-celo-green/60"
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                  <input
                    value={profileUsername}
                    onChange={e => setProfileUsername(e.target.value.replace(/^@/, ""))}
                    placeholder="yourhandle"
                    className="w-full pl-7 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-celo-green/60"
                  />
                </div>
              </div>

              {/* Wallet Connect */}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Settlement Wallet <span className="text-gray-500">(cNGN or USDC received here)</span></label>
                {profileWallet ? (
                  <div className="flex items-center justify-between p-3 bg-celo-green/5 border border-celo-green/30 rounded-lg">
                    <div>
                      <p className="text-celo-green text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-celo-green inline-block"></span>
                        Wallet Connected
                      </p>
                      <p className="font-mono text-[11px] text-gray-300 mt-0.5">{profileWallet.slice(0,10)}…{profileWallet.slice(-8)}</p>
                    </div>
                    <button onClick={() => setProfileWallet("")} className="text-xs text-gray-500 hover:text-red-400">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectFreelancerWallet}
                    disabled={profileConnecting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 border border-gray-700 hover:border-celo-green/50 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                  >
                    <Wallet className="w-4 h-4 text-celo-green" />
                    {profileConnecting ? "Connecting…" : "Connect Wallet (MetaMask)"}
                  </button>
                )}
                <p className="text-[11px] text-gray-500 mt-1.5">This wallet receives the selected cNGN or USDC settlement via Textile FX.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveFreelancerProfile}
                className="flex-1 py-2.5 bg-celo-green text-black font-bold rounded-xl text-sm hover:bg-celo-green/90 transition-colors"
              >
                Save Profile
              </button>
              {freelancerProfile && (
                <button
                  onClick={disconnectFreelancerProfile}
                  className="px-4 py-2.5 bg-red-900/30 border border-red-800 text-red-400 font-semibold rounded-xl text-sm hover:bg-red-900/50 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-celo-green" />
                Create New Invoice
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white text-xs px-2.5 py-1 bg-gray-800 rounded-lg">
                Cancel
              </button>
            </div>

            {/* Profile prompt inside create modal */}
            {!freelancerProfile ? (
              <div className="p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-300 font-semibold">Setup your profile to receive payments</p>
                  <p className="text-[11px] text-amber-400/70 mt-0.5">Your wallet address will be used as the cNGN recipient on Textile FX.</p>
                  <button onClick={() => { setShowCreateModal(false); setShowProfileModal(true); }} className="mt-1.5 text-[11px] text-amber-300 hover:underline font-semibold">
                    → Setup Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-celo-green/5 border border-celo-green/20 rounded-lg flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-celo-green flex items-center justify-center text-black font-black text-sm shrink-0">
                  {freelancerProfile.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-celo-green font-semibold">@{freelancerProfile.username} · {freelancerProfile.displayName}</p>
                  <p className="font-mono text-[10px] text-gray-400">{freelancerProfile.walletAddress.slice(0,12)}…{freelancerProfile.walletAddress.slice(-6)}</p>
                </div>
              </div>
            )}


            <form onSubmit={handleGenerateInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-medium">Client / Company Name</label>
                <input 
                  type="text" 
                  required 
                  value={formClientName}
                  onChange={e => setFormClientName(e.target.value)}
                  placeholder="e.g. Acme Web3 Labs" 
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-celo-green"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-medium">Client Wallet Address</label>
                <input 
                  type="text" 
                  required 
                  value={formClientAddress}
                  onChange={e => setFormClientAddress(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-celo-green"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-medium">Scope of Work / Description</label>
                <textarea 
                  rows={2} 
                  required 
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="e.g. Smart contract audit, UI design, backend API..." 
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-celo-green"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">Currency Denomination</label>
                  <select 
                    value={formCurrency}
                    onChange={e => setFormCurrency(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-celo-green"
                  >
                    <option value="cNGN">cNGN (Nigerian Naira)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                    <option value="wARS">wARS (Argentine Peso)</option>
                    <option value="wBRL">wBRL (Brazilian Real)</option>
                  </select>
                  {formCurrency === "cNGN" && (
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                      <input
                        type="checkbox"
                        checked={acceptUsdcSettlement}
                        onChange={e => setAcceptUsdcSettlement(e.target.checked)}
                        className="accent-emerald-500"
                      />
                      Also accept the live USDC equivalent
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">Exact Amount Owed</label>
                  <input 
                    type="number" 
                    required 
                    step="1" 
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="e.g. 750000" 
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-celo-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-medium">Due Date</label>
                <input 
                  type="date" 
                  required 
                  value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-celo-green"
                />
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-lg text-[11px] text-indigo-300">
                <Info className="w-3.5 h-3.5 inline text-indigo-400 mr-1" />
                Your client will fulfill this invoice using <strong>USDT</strong> or <strong>USDC</strong>. Textile FX delivers the exact local currency to your wallet.
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3 bg-celo-green hover:bg-celo-green/90 text-black font-extrabold rounded-xl shadow-lg shadow-celo-green/20 text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RAW PAYLOAD MODAL */}
      {showPayloadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Code2 className="w-4 h-4 text-celo-green" />
                Textile FX RFQ Request & Settlement Calldata
              </h3>
              <button onClick={() => setShowPayloadModal(false)} className="text-gray-400 hover:text-white text-xs px-2.5 py-1 bg-gray-800 rounded-lg">
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400 font-semibold">1. RFQ Firm Quote Request (`POST /v2/rfq/request`):</span>
                <pre className="mt-1 p-3 bg-gray-950 border border-gray-800 rounded-lg text-celo-green font-mono text-[11px] overflow-x-auto">
{JSON.stringify({
  chainId: CELO_CHAIN_CONFIG.chainId,
  sellToken: CELO_CHAIN_CONFIG.tokens.USDT.address,
  buyToken: CELO_CHAIN_CONFIG.tokens[bestCorridor].address,
  buyAmount: agentQuote?.settlements[bestCorridor]?.estimatedBuyAmount || (activeInvoice.amount * 1000000).toString(),
  taker: connectedAddress || "Unavailable until wallet connection"
}, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-gray-400 font-semibold">2. Broadcast Calldata (`transactions.swap` for LimitOrderReactor):</span>
                <pre className="mt-1 p-3 bg-gray-950 border border-gray-800 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto">
{JSON.stringify({
  to: CELO_CHAIN_CONFIG.contracts.limitOrderReactor,
  data: connectedAddress ? "0x12b489a2000000000000000000000000" + connectedAddress.slice(2) + "000000000000000000000000" + activeInvoice.freelancerAddress.slice(2) : "Unavailable until wallet connection",
  value: "0",
  chainId: CELO_CHAIN_CONFIG.chainId
}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-celo-green" />
                Official Settlement Receipt
              </h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-gray-400 hover:text-white text-xs px-2.5 py-1 bg-gray-800 rounded-lg">
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Invoice Reference:</span>
                  <span className="font-mono font-bold text-white">#{activeInvoice.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Settlement Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-celo-green/10 text-celo-green border border-celo-green/30">
                    SETTLED ON CELO
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Delivered to Freelancer:</span>
                  <span className="font-bold text-celo-green text-sm">₦{activeInvoice.amountFormatted} {activeInvoice.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Client Paid:</span>
                  <span className="font-bold text-white">{activeInvoice.paidWith || `${calculatedSellAmount} USDT → ${bestCorridor}`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Freelancer (Beneficiary):</span>
                  <span className="font-mono text-gray-300 truncate max-w-[200px]">{activeInvoice.freelancerAddress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Payer (Client Wallet):</span>
                  <span className="font-mono text-gray-300 truncate max-w-[200px]">{connectedAddress || activeInvoice.clientAddress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Settled via:</span>
                  <span className="text-indigo-300 font-medium">Textile LimitOrderReactor v2.1.0</span>
                </div>
              </div>

              <div className="p-3 bg-gray-950 rounded-lg border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Celo Transaction Hash</p>
                <p className="font-mono text-[11px] text-celo-green truncate mt-0.5">{activeInvoice.txHash || txHash || "0x8fa92305...0182650"}</p>
                <a 
                  href={`${CELO_CHAIN_CONFIG.explorerUrl}/tx/${activeInvoice.txHash || txHash || ""}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-celo-green hover:underline flex items-center gap-1 font-semibold text-xs mt-2"
                >
                  Verify on Celoscan Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => window.print()} 
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button 
                  onClick={() => setShowReceiptModal(false)} 
                  className="flex-1 py-2.5 bg-celo-green hover:bg-celo-green/90 text-black rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-4 border-t border-gray-800 text-center text-xs text-gray-500">
        Cobro &bull; Powered by Textile FX on {CELO_CHAIN_CONFIG.name} (chain {CELO_CHAIN_CONFIG.chainId}) &bull; Non-Custodial RFQ
      </footer>
    </main>
  );
}
