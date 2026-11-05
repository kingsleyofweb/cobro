"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimalRoute = getOptimalRoute;
/** Live settlement optimizer for Cobro. The client pays in USDT. */
const celo_1 = require("../config/celo");
const TEXTILE_API_BASE = "https://api.textilecredit.com/v2";
async function fetchPreview(buyToken, buyAmountUnits) {
    const res = await fetch(`${TEXTILE_API_BASE}/rfq/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chainId: celo_1.CELO_CONFIG.chainId,
            sellToken: celo_1.CELO_CONFIG.tokens.USDT.address,
            buyToken: celo_1.CELO_CONFIG.tokens[buyToken].address,
            buyAmount: buyAmountUnits,
        }),
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok)
        throw new Error(`Textile ${buyToken} preview HTTP ${res.status}`);
    const json = await res.json();
    const data = json.data ?? json;
    const sellAmount = data.sellAmount ?? data.takerPays ?? data.estimatedSellAmount;
    if (!sellAmount)
        throw new Error(`Textile ${buyToken} preview returned no sellAmount`);
    return { sellAmount: String(sellAmount), effectiveRate: Number(buyAmountUnits) / Number(sellAmount) };
}
const formatUnits = (value) => (Number(value) / 1e6).toFixed(2);
function unavailable(currency, reason) {
    return {
        settlementCurrency: currency,
        buyTokenAddress: celo_1.CELO_CONFIG.tokens[currency].address,
        estimatedBuyAmount: "0",
        estimatedBuyAmountFormatted: "Unavailable",
        estimatedSellAmount: "0",
        estimatedSellAmountFormatted: "Unavailable",
        effectiveRate: 0,
        liveData: false,
        available: false,
        route: "direct",
        reason,
    };
}
async function getOptimalRoute(amountUnits, acceptedCurrencies = ["cNGN"]) {
    const accepted = [...new Set(acceptedCurrencies)].filter((value) => value === "cNGN" || value === "USDC");
    if (accepted.length === 0)
        throw new Error("Invoice has no supported settlement currency");
    let cngnQuote;
    let cngnPreview;
    if (accepted.includes("cNGN")) {
        try {
            cngnPreview = await fetchPreview("cNGN", amountUnits);
            cngnQuote = {
                settlementCurrency: "cNGN",
                buyTokenAddress: celo_1.CELO_CONFIG.tokens.cNGN.address,
                estimatedBuyAmount: amountUnits,
                estimatedBuyAmountFormatted: formatUnits(amountUnits),
                estimatedSellAmount: cngnPreview.sellAmount,
                estimatedSellAmountFormatted: formatUnits(cngnPreview.sellAmount),
                effectiveRate: cngnPreview.effectiveRate,
                liveData: true,
                available: true,
                route: "direct",
            };
        }
        catch (error) {
            cngnQuote = unavailable("cNGN", error instanceof Error ? error.message : "cNGN route unavailable");
        }
    }
    let usdcQuote;
    if (accepted.includes("USDC")) {
        try {
            // Use the live cNGN rate to calculate the equivalent USDC output, then
            // price that exact output through the independent USDT→USDC corridor.
            const usdcAmount = cngnPreview
                ? (BigInt(amountUnits) * 1000000n / BigInt(Math.max(1, Math.floor(cngnPreview.effectiveRate * 1_000_000)))).toString()
                : amountUnits;
            const preview = await fetchPreview("USDC", usdcAmount);
            usdcQuote = {
                settlementCurrency: "USDC",
                buyTokenAddress: celo_1.CELO_CONFIG.tokens.USDC.address,
                estimatedBuyAmount: usdcAmount,
                estimatedBuyAmountFormatted: formatUnits(usdcAmount),
                estimatedSellAmount: preview.sellAmount,
                estimatedSellAmountFormatted: formatUnits(preview.sellAmount),
                effectiveRate: preview.effectiveRate,
                liveData: true,
                available: true,
                route: "direct",
            };
        }
        catch (error) {
            usdcQuote = unavailable("USDC", error instanceof Error ? error.message : "USDC route unavailable");
        }
    }
    const available = [cngnQuote, usdcQuote].filter((quote) => !!quote && quote.available);
    if (available.length === 0)
        throw new Error("No live Textile settlement route is available");
    const best = available.reduce((a, b) => BigInt(a.estimatedSellAmount) <= BigInt(b.estimatedSellAmount) ? a : b);
    const other = available.find((quote) => quote.settlementCurrency !== best.settlementCurrency);
    const savings = other
        ? `${formatUnits((BigInt(other.estimatedSellAmount) - BigInt(best.estimatedSellAmount)).toString())} USDT cheaper — agent selected ${best.settlementCurrency}`
        : `Agent selected the live ${best.settlementCurrency} settlement route`;
    return {
        bestSettlementCurrency: best.settlementCurrency,
        settlements: { cNGN: cngnQuote, USDC: usdcQuote },
        savings,
    };
}
