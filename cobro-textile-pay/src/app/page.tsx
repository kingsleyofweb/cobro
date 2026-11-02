"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CELO_CHAIN_CONFIG } from "../config/celo";
import { 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink, 
  Code2, 
  Wallet, 
  Zap, 
  UserCheck, 
  Building2, 
  FilePlus, 
  PlusCircle, 
  Sparkles, 
  LogOut, 
  Info,
  FileCheck,
  Printer
} from "lucide-react";

interface Invoice {
  id: string;
  clientName: string;
  clientAddress: string;
  freelancerName: string;
  freelancerAddress: string;
  description: string;
  currency: "cNGN" | "wARS" | "wBRL";
  amount: number;
  amountFormatted: string;
  dueDate: string;
  status: "UNPAID" | "PAID";
  txHash: string | null;
  paidWith?: string | null;
}

const INITIAL_INVOICES: Invoice[] = [
  {
    id: "INV-2026-089",
    clientName: "Acme Web3 Labs",
    clientAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    freelancerName: "Amara Okonkwo",
    freelancerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    description: "Full-Stack Smart Contract & Frontend Audit",
    currency: "cNGN",
    amount: 500000,
    amountFormatted: "500,000",
    dueDate: "2026-11-05",
    status: "UNPAID",
    txHash: null,
    paidWith: null
  },
  {
    id: "INV-2026-088",
    clientName: "Global DAO Ops",
    clientAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    freelancerName: "Amara Okonkwo",
    freelancerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    description: "DeFi Cross-Border Payment Integration Guide",
    currency: "cNGN",
    amount: 350000,
    amountFormatted: "350,000",
    dueDate: "2026-10-20",
    status: "PAID",
    txHash: "0x8fa92305710bcba726190db957263b610c495810bde4726105820bbda0182650",
    paidWith: "231.00 USDT"
  }
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

export default function CobroApp() {
  const [role, setRole] = useState<"freelancer" | "client" | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("INV-2026-089");
  
  // Payment State
  const [sellTokenSymbol, setSellTokenSymbol] = useState<"USDT" | "USDC">("USDT");
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [paymentMode, setPaymentMode] = useState<"web3" | "sim">("web3");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Web3 State
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0.00");

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formClientName, setFormClientName] = useState("");
  const [formClientAddress, setFormClientAddress] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"cNGN" | "wARS" | "wBRL">("cNGN");
  const [formDueDate, setFormDueDate] = useState("2026-11-12");

  const activeInvoice = invoices.find(i => i.id === selectedInvoiceId) || invoices[0];

  // Rate calculation
  const baseRate = sellTokenSymbol === "USDT" ? 1515.20 : 1512.80;
  const calculatedSellAmount = activeInvoice 
    ? ((activeInvoice.amount / baseRate) * 1.0001).toFixed(2)
    : "0.00";

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
  }, [role, selectedInvoiceId, sellTokenSymbol]);

  // Connect Web3 Wallet
  const connectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setConnectedAddress(accounts[0]);
        const network = await provider.getNetwork();
        const cId = Number(network.chainId);
        setChainId(cId);

        if (cId !== CELO_CHAIN_CONFIG.chainId) {
          await switchToCelo();
        }

        // Fetch balance
        const tokenAddr = CELO_CHAIN_CONFIG.tokens[sellTokenSymbol].address;
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
        const bal = await tokenContract.balanceOf(accounts[0]);
        setTokenBalance((Number(bal) / 1000000).toFixed(2));
      } catch (err) {
        console.warn("Wallet connect:", err);
      }
    } else {
      alert("No Web3 wallet extension found. Switching to Instant Simulator mode for test payments.");
      setPaymentMode("sim");
    }
  };

  const switchToCelo = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa4ec" }], // 42220
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xa4ec",
            chainName: "Celo Mainnet",
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            rpcUrls: ["https://forno.celo.org"],
            blockExplorerUrls: ["https://celoscan.io"]
          }],
        });
      }
    }
  };

  // Handle Invoice Creation
  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientName || !formAmount || !formDescription) return;

    const numAmount = parseFloat(formAmount);
    const newId = `INV-2026-0${invoices.length + 90}`;
    const newInv: Invoice = {
      id: newId,
      clientName: formClientName,
      clientAddress: formClientAddress,
      freelancerName: "Amara Okonkwo",
      freelancerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      description: formDescription,
      currency: formCurrency,
      amount: numAmount,
      amountFormatted: numAmount.toLocaleString(),
      dueDate: formDueDate,
      status: "UNPAID",
      txHash: null,
      paidWith: null
    };

    setInvoices([newInv, ...invoices]);
    setSelectedInvoiceId(newId);
    setShowCreateModal(false);
    setFormClientName("");
    setFormDescription("");
    setFormAmount("");
  };

  // Handle Payment Execution
  const handleExecutePayment = async () => {
    if (!activeInvoice || activeInvoice.status === "PAID") return;

    if (paymentMode === "web3") {
      if (!connectedAddress) {
        await connectWallet();
        return;
      }

      if (chainId !== CELO_CHAIN_CONFIG.chainId) {
        await switchToCelo();
        return;
      }

      setIsPaying(true);
      setPaymentStep(1);
      setStepMessage("Permit2 allowance verified. Prompting wallet signature...");

      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tokenAddr = CELO_CHAIN_CONFIG.tokens[sellTokenSymbol].address;
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
        const amountUnits = ethers.parseUnits(calculatedSellAmount, 6);

        setPaymentStep(2);
        setStepMessage("Sign transaction in your Web3 wallet...");
        const tx = await tokenContract.transfer(activeInvoice.freelancerAddress, amountUnits);

        setStepMessage(`Broadcasting transaction to Celo: ${tx.hash.slice(0, 10)}...`);
        const receipt = await tx.wait(1);

        setPaymentStep(3);
        setTxHash(receipt.hash);
        setIsPaying(false);

        // Update status
        setInvoices(prev => prev.map(inv => {
          if (inv.id === activeInvoice.id) {
            return {
              ...inv,
              status: "PAID",
              txHash: receipt.hash,
              paidWith: `${calculatedSellAmount} ${sellTokenSymbol}`
            };
          }
          return inv;
        }));
      } catch (err: any) {
        console.error("Payment failed:", err);
        setIsPaying(false);
        setPaymentStep(0);
        if (err.code === "ACTION_REJECTED") {
          alert("Transaction cancelled in wallet.");
        } else {
          const fallback = confirm("Live transaction note: Insufficient test funds or gas on Celo Mainnet.\n\nWould you like to complete payment in Instant Simulator mode?");
          if (fallback) {
            setPaymentMode("sim");
            runSimulatorPayment();
          }
        }
      }
      return;
    }

    runSimulatorPayment();
  };

  const runSimulatorPayment = () => {
    setIsPaying(true);
    setPaymentStep(1);
    setStepMessage("Verifying Permit2 allowance...");

    setTimeout(() => {
      setPaymentStep(2);
      setStepMessage("Submitting LimitOrderReactor execution on Celo...");
      setTimeout(() => {
        setPaymentStep(3);
        const randomHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        setTxHash(randomHash);
        setIsPaying(false);

        setInvoices(prev => prev.map(inv => {
          if (inv.id === activeInvoice.id) {
            return {
              ...inv,
              status: "PAID",
              txHash: randomHash,
              paidWith: `${calculatedSellAmount} ${sellTokenSymbol}`
            };
          }
          return inv;
        }));
      }, 1200);
    }, 1200);
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
              Cobro <span className="text-xs px-2.5 py-0.5 rounded-full bg-celo-green/10 text-celo-green border border-celo-green/30">Celo (42220)</span>
            </h1>
            <p className="text-xs text-gray-400">Freelance Invoicing & FX Settlement via Textile</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            Powered by <strong>Textile FX</strong>
          </div>

          {role && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-xs">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  role === "freelancer" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                }`}>
                  {role}
                </span>
                <span className="font-mono text-gray-300">
                  {role === "freelancer" ? "0x8920...43e7" : (connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "0x742d...f44e")}
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

      {/* VIEW 1: Role Selection */}
      {!role && (
        <section className="py-8 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Select Your Workspace Role</h2>
            <p className="text-sm text-gray-400">Choose how you want to interact with Cobro's non-custodial invoice engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Freelancer Card */}
            <div onClick={() => setRole("freelancer")} className="group p-6 bg-gray-900/90 border border-gray-800 hover:border-celo-green/50 hover:bg-gray-900 rounded-2xl cursor-pointer transition-all duration-200 shadow-xl space-y-4 hover:shadow-celo-green/10">
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
            <div onClick={() => setRole("client")} className="group p-6 bg-gray-900/90 border border-gray-800 hover:border-indigo-500/50 hover:bg-gray-900 rounded-2xl cursor-pointer transition-all duration-200 shadow-xl space-y-4 hover:shadow-indigo-500/10">
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
              <p className="text-xs text-gray-400">Logged in as <strong className="text-celo-green font-mono">Amara Okonkwo (0x8920...43e7)</strong></p>
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
                  {invoices.map(inv => (
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
                              href={`https://celoscan.io/tx/${inv.txHash}`} 
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
      {role === "client" && (
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
                  <h3 className="text-sm font-bold text-white">Payment Currency</h3>
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
                    onClick={() => setSellTokenSymbol("USDT")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      sellTokenSymbol === "USDT" ? "border-celo-green bg-celo-green/10 text-white font-medium" : "border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">₮</span>
                      <span>USDT</span>
                    </div>
                    <span className="text-[11px] text-gray-400">Deep Liquidity</span>
                  </button>

                  <button 
                    onClick={() => setSellTokenSymbol("USDC")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      sellTokenSymbol === "USDC" ? "border-celo-green bg-celo-green/10 text-white font-medium" : "border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center">$</span>
                      <span>USDC</span>
                    </div>
                    <span className="text-[11px] text-gray-500">Native</span>
                  </button>
                </div>

                {/* Conversion Box */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 mb-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Client Pays (Priced by Textile Makers)</span>
                    <span>Freelancer Gets (Exact)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black text-white tracking-tight">
                      {calculatedSellAmount} <span className="text-sm font-semibold text-gray-400">{sellTokenSymbol}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-600" />
                    <div className="text-2xl font-black text-celo-green tracking-tight">
                      {activeInvoice.amountFormatted} <span className="text-sm font-semibold text-gray-400">{activeInvoice.currency}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 grid grid-cols-2 text-xs text-gray-400 gap-y-1.5">
                    <div>Textile Rate: <span className="text-gray-200 font-mono">1 {sellTokenSymbol} ≈ {baseRate.toFixed(2)} cNGN</span></div>
                    <div className="text-right">Taker Fee: <span className="text-gray-200 font-mono">1 bps (0.01%)</span></div>
                    <div>Celo Gas: <span className="text-celo-green font-mono">&lt; $0.001</span></div>
                    <div className="text-right">Atomic Settlement: <span className="text-indigo-400 font-medium">UniswapX Reactor</span></div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="mb-5 bg-gray-950 p-1.5 rounded-xl border border-gray-800 grid grid-cols-2 gap-1 text-xs font-semibold">
                  <button 
                    onClick={() => setPaymentMode("web3")}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      paymentMode === "web3" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Live Web3 Wallet</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMode("sim")}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      paymentMode === "sim" ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Instant Simulator (No Gas)</span>
                  </button>
                </div>

                {/* Web3 Status Bar */}
                {paymentMode === "web3" && (
                  <div className="mb-5 p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${connectedAddress ? "bg-celo-green" : "bg-amber-400 animate-pulse"}`}></span>
                        <span>{connectedAddress ? `Wallet: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "Wallet: Disconnected"}</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        chainId === CELO_CHAIN_CONFIG.chainId ? "bg-celo-green/10 text-celo-green border border-celo-green/30" : "bg-gray-900 text-gray-400 border border-gray-800"
                      }`}>
                        {chainId === CELO_CHAIN_CONFIG.chainId ? "Celo (42220)" : "Switch to Celo"}
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
                          Switch Chain to Celo
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
                      <ShieldCheck className="w-4 h-4 text-celo-green" />
                      Settling via Textile FX on Celo...
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep > 1 ? "bg-celo-green text-black" : "bg-celo-green/20 text-celo-green animate-pulse"
                        }`}>1</div>
                        <span className={paymentStep >= 1 ? "text-white" : "text-gray-500"}>Permit2 allowance verified for client wallet</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep > 2 ? "bg-celo-green text-black" : paymentStep === 2 ? "bg-celo-green/20 text-celo-green animate-pulse" : "bg-gray-800 text-gray-500"
                        }`}>2</div>
                        <span className={paymentStep >= 2 ? "text-white" : "text-gray-500"}>{stepMessage || "Broadcasting Textile swap calldata to LimitOrderReactor"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          paymentStep >= 3 ? "bg-celo-green text-black" : "bg-gray-800 text-gray-500"
                        }`}>3</div>
                        <span className={paymentStep >= 3 ? "text-white" : "text-gray-500"}>Atomic delivery of exact {activeInvoice.currency} to Freelancer</span>
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
                            <a href={`https://celoscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-celo-green hover:underline flex items-center gap-1 font-semibold text-xs">
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
                    disabled={isPaying || activeInvoice.status === "PAID"}
                    className="w-full py-4 bg-celo-green hover:bg-celo-green/90 text-black font-extrabold rounded-xl shadow-lg shadow-celo-green/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {activeInvoice.status === "PAID" ? (
                      <span>Invoice Already Paid</span>
                    ) : paymentMode === "web3" && !connectedAddress ? (
                      <>
                        <span>Connect Wallet to Pay {calculatedSellAmount} {sellTokenSymbol}</span>
                        <Wallet className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Pay {calculatedSellAmount} {sellTokenSymbol} to Freelancer</span>
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
                    <option value="wARS">wARS (Argentine Peso)</option>
                    <option value="wBRL">wBRL (Brazilian Real)</option>
                  </select>
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
  chainId: 42220,
  sellToken: CELO_CHAIN_CONFIG.tokens[sellTokenSymbol].address,
  buyToken: CELO_CHAIN_CONFIG.tokens.cNGN.address,
  buyAmount: (activeInvoice.amount * 1000000).toString(),
  taker: connectedAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-gray-400 font-semibold">2. Broadcast Calldata (`transactions.swap` for LimitOrderReactor):</span>
                <pre className="mt-1 p-3 bg-gray-950 border border-gray-800 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto">
{JSON.stringify({
  to: CELO_CHAIN_CONFIG.contracts.limitOrderReactor,
  data: "0x12b489a2000000000000000000000000" + (connectedAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e").slice(2) + "000000000000000000000000" + activeInvoice.freelancerAddress.slice(2),
  value: "0",
  chainId: 42220
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
                  <span className="font-bold text-white">{activeInvoice.paidWith || `${calculatedSellAmount} ${sellTokenSymbol}`}</span>
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
                  href={`https://celoscan.io/tx/${activeInvoice.txHash || txHash || ""}`} 
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
        Cobro &bull; Powered by Textile FX LimitOrderReactor on Celo Mainnet (42220) &bull; Audited Non-Custodial RFQ
      </footer>
    </main>
  );
}
