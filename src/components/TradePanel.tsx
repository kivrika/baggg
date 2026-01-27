"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface TradePanelProps {
  tokenMint: string;
  tokenSymbol: string;
}

export default function TradePanel({ tokenMint, tokenSymbol }: TradePanelProps) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);

  const wallet = wallets[0];

  const fetchQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const lamports = side === "buy"
        ? String(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL))
        : amount;

      const res = await fetch(
        `/api/trade/quote?tokenMint=${tokenMint}&amount=${lamports}&side=${side}`
      );
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Failed to get quote");
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async () => {
    if (!wallet || !quote) return;
    setLoading(true);
    setStatus("Creating transaction...");

    try {
      const lamports = side === "buy"
        ? String(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL))
        : amount;

      const quoteRes = await fetch(
        `/api/trade/quote?tokenMint=${tokenMint}&amount=${lamports}&side=${side}`
      );
      const quoteData = await quoteRes.json();
      if (!quoteData.success) throw new Error(quoteData.error);

      const swapRes = await fetch("/api/trade/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quoteData.quote,
          userPublicKey: wallet.address,
        }),
      });
      const swapData = await swapRes.json();
      if (!swapData.success) throw new Error(swapData.error);

      setStatus("Signing transaction...");
      const txBytes = Uint8Array.from(atob(swapData.transaction), (c) => c.charCodeAt(0));

      const { signature } = await signAndSendTransaction({
        wallet,
        transaction: txBytes,
      });

      setStatus(`Trade successful! Tx: ${String(signature).slice(0, 8)}...`);
      setQuote(null);
      setAmount("");
    } catch (error) {
      setStatus(`Trade failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <p className="text-gray-500">Login with X to trade</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h3 className="text-lg font-semibold mb-5">
        Trade <span className="text-violet-400">{tokenSymbol}</span>
      </h3>

      {/* Buy / Sell Toggle */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.04]">
        <button
          onClick={() => { setSide("buy"); setQuote(null); }}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
            side === "buy"
              ? "bg-green-500/15 text-green-400 border border-green-500/20 shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setSide("sell"); setQuote(null); }}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
            side === "sell"
              ? "bg-red-500/15 text-red-400 border border-red-500/20 shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-5">
        <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
          {side === "buy" ? "Amount (SOL)" : "Amount (tokens)"}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
            placeholder={side === "buy" ? "0.1" : "1000"}
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-700 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.04] transition-all text-lg font-mono"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-600 font-medium">
            {side === "buy" ? "SOL" : tokenSymbol}
          </span>
        </div>
      </div>

      {/* Quote Preview */}
      {quote && (
        <div className="mb-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">You receive</span>
            <span className="text-white font-mono font-medium">
              {side === "buy"
                ? `${Number(quote.outAmount).toLocaleString()} tokens`
                : `${(parseInt(quote.outAmount) / LAMPORTS_PER_SOL).toFixed(6)} SOL`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Price impact</span>
            <span className={`font-mono ${parseFloat(quote.priceImpactPct) > 5 ? "text-red-400" : parseFloat(quote.priceImpactPct) > 2 ? "text-yellow-400" : "text-green-400"}`}>
              {parseFloat(quote.priceImpactPct).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!quote ? (
          <button
            onClick={fetchQuote}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/10"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Getting quote...
              </span>
            ) : "Get Quote"}
          </button>
        ) : (
          <>
            <button
              onClick={executeTrade}
              disabled={loading}
              className={`flex-1 py-3.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 shadow-lg ${
                side === "buy"
                  ? "bg-green-600 hover:bg-green-500 shadow-green-500/10"
                  : "bg-red-600 hover:bg-red-500 shadow-red-500/10"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : `Confirm ${side === "buy" ? "Buy" : "Sell"}`}
            </button>
            <button
              onClick={() => setQuote(null)}
              className="px-5 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] transition"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Status */}
      {status && (
        <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
          status.includes("Error") || status.includes("failed")
            ? "bg-red-500/10 border border-red-500/20 text-red-400"
            : status.includes("successful")
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-white/[0.03] border border-white/[0.06] text-gray-400"
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
