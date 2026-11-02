"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { textileRfq, FirmQuoteResponse, PreviewResponse } from "../services/textileRfq";
import { CELO_CHAIN_CONFIG } from "../config/celo";

export interface UseTextileQuoteProps {
  sellTokenSymbol: "USDT" | "USDC";
  buyTokenSymbol: "cNGN" | "wARS" | "wBRL";
  exactBuyAmountUnits: string; // e.g. "500000000000" for 500k cNGN
  takerAddress?: string;
  autoRequestFirmQuote?: boolean;
}

export function useTextileQuote({
  sellTokenSymbol,
  buyTokenSymbol,
  exactBuyAmountUnits,
  takerAddress,
  autoRequestFirmQuote = true,
}: UseTextileQuoteProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [quote, setQuote] = useState<FirmQuoteResponse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sellToken = CELO_CHAIN_CONFIG.tokens[sellTokenSymbol];
  const buyToken = CELO_CHAIN_CONFIG.tokens[buyTokenSymbol];

  // Fetch indicative preview
  const fetchPreview = useCallback(async () => {
    try {
      const data = await textileRfq.getPreview({
        chainId: CELO_CHAIN_CONFIG.chainId,
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        buyAmount: exactBuyAmountUnits,
      });
      setPreview(data);
    } catch (err: any) {
      console.error("Preview error:", err);
    }
  }, [sellToken.address, buyToken.address, exactBuyAmountUnits]);

  // Request firm quote (blocks for ~750ms while makers price it)
  const fetchFirmQuote = useCallback(async () => {
    if (!takerAddress) return;
    setIsLoading(true);
    setError(null);

    try {
      const firmQuote = await textileRfq.requestFirmQuote({
        chainId: CELO_CHAIN_CONFIG.chainId,
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        buyAmount: exactBuyAmountUnits,
        taker: takerAddress,
      });

      if (firmQuote.status === "no_quote") {
        setError(firmQuote.reason || "No market makers quoted this size");
        setQuote(null);
      } else {
        setQuote(firmQuote);
        setTimeLeft(60);
      }
    } catch (err: any) {
      setError(err.message || "Failed to obtain firm quote");
    } finally {
      setIsLoading(false);
    }
  }, [takerAddress, sellToken.address, buyToken.address, exactBuyAmountUnits]);

  // Handle live 60s countdown
  useEffect(() => {
    if (!quote) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Quote expired: auto-refresh if taker connected
          fetchFirmQuote();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quote, fetchFirmQuote]);

  // Trigger preview on token change
  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Auto-request firm quote if taker address is available
  useEffect(() => {
    if (autoRequestFirmQuote && takerAddress) {
      fetchFirmQuote();
    }
  }, [autoRequestFirmQuote, takerAddress, fetchFirmQuote]);

  // Formatted amounts
  const formattedSellAmount = quote
    ? (Number(quote.sellAmount) / 10 ** sellToken.decimals).toFixed(2)
    : preview
    ? (Number(preview.estimatedSellAmount) / 10 ** sellToken.decimals).toFixed(2)
    : "---";

  const formattedBuyAmount = (
    Number(exactBuyAmountUnits) / 10 ** buyToken.decimals
  ).toLocaleString();

  return {
    preview,
    quote,
    timeLeft,
    isLoading,
    error,
    formattedSellAmount,
    formattedBuyAmount,
    effectiveRate: quote?.effectiveRate || preview?.effectiveRate || 1515.2,
    refreshQuote: fetchFirmQuote,
  };
}
