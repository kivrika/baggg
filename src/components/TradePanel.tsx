"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrCreateWallet, getKeypair } from "@/lib/wallet";

const LAMPORTS_PER_SOL = 1_000_000_000;
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

interface TradePanelProps {
  tokenMint: string;
  tokenSymbol: string;
}

export default function TradePanel({ tokenMint, tokenSymbol }: TradePanelProps) {
  const { authenticated } = usePrivy();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  useEffect(() => {
    const wallet = getOrCreateWallet();
    setWalletAddress(wallet.publicKey);
  }, []);

  const fetchTokenBalance = async () => {
    if (!walletAddress || !tokenMint) return;
    try {
      const res = await fetch(`/api/token-balance?wallet=${walletAddress}&tokenMint=${tokenMint}`);
      const data = await res.json();
      if (data.success) {
        setTokenBalance(data.balance);
      }
    } catch (e) {
      console.error("Failed to fetch token balance:", e);
    }
  };

  useEffect(() => {
    if (walletAddress && tokenMint) {
      fetchTokenBalance();
    }
  }, [walletAddress, tokenMint]);

  const signAndSendTransaction = async (txData: string): Promise<string> => {
    const keypair = getKeypair();
    if (!keypair) throw new Error("Wallet not found");

    const connection = new Connection(RPC_URL, "confirmed");

    console.log("Transaction data type:", typeof txData);
    console.log("Transaction data length:", txData?.length);
    console.log("Transaction data preview:", txData?.substring(0, 50));

    // Try base58 first (BagsAPI uses this), then fallback to base64
    let txBytes: Uint8Array;
    try {
      txBytes = bs58.decode(txData);
      console.log("Decoded as base58, bytes:", txBytes.length);
    } catch (e1) {
      console.log("Base58 failed:", e1);
      try {
        txBytes = Uint8Array.from(atob(txData), (c) => c.charCodeAt(0));
        console.log("Decoded as base64, bytes:", txBytes.length);
      } catch (e2) {
        console.log("Base64 failed:", e2);
        throw new Error(`Could not decode transaction (len=${txData?.length}, start=${txData?.substring(0, 30)}...)`);
      }
    }

    const transaction = VersionedTransaction.deserialize(txBytes);

    // Sign the transaction
    transaction.sign([keypair]);

    // Send the transaction
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    await connection.confirmTransaction(signature, "confirmed");

    return signature;
  };

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
    if (!walletAddress || !quote) return;
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
          userPublicKey: walletAddress,
        }),
      });
      const swapData = await swapRes.json();
      console.log("Swap response:", JSON.stringify(swapData, null, 2));
      if (!swapData.success) throw new Error(swapData.error);

      // Extract transaction string - API returns swapTransaction
      const txString = swapData.swapTransaction || swapData.transaction;
      if (!txString || typeof txString !== 'string') {
        throw new Error("No transaction in response: " + JSON.stringify(swapData).substring(0, 200));
      }

      if (!txString) {
        throw new Error("Transaction string is empty");
      }

      setStatus("Signing transaction...");
      const signature = await signAndSendTransaction(txString);

      setStatus(`Trade successful! Tx: ${signature.slice(0, 8)}...`);
      setQuote(null);
      setAmount("");
      // Refresh balance after trade
      setTimeout(fetchTokenBalance, 2000);
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
      <h3 className="text-lg font-semibold mb-3">
        Trade <span className="text-violet-400">{tokenSymbol}</span>
      </h3>

      {/* Token Balance */}
      <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Your Balance</span>
          <button
            onClick={fetchTokenBalance}
            className="text-xs text-gray-600 hover:text-gray-400 transition"
          >
            ↻
          </button>
        </div>
        <p className="text-lg font-mono font-medium text-white mt-1">
          {tokenBalance !== null ? tokenBalance.toLocaleString() : "—"} <span className="text-sm text-gray-500">{tokenSymbol}</span>
        </p>
      </div>

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
