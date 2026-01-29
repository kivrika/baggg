"use client";

import { useState, useEffect, useCallback } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getKeypair } from "@/lib/wallet";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

interface FeeClaimProps {
  tokenMint: string;
  walletAddress: string;  // Fee claimer wallet (from DB)
  signerWallet?: string;  // Current wallet for signing (from localStorage)
}

export default function FeeClaim({ tokenMint, walletAddress, signerWallet }: FeeClaimProps) {
  const [claimable, setClaimable] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Check if signer wallet matches fee claimer wallet
  const canClaim = signerWallet === walletAddress;

  // Debug: log wallet addresses on mount
  useEffect(() => {
    console.log("FeeClaim mounted:");
    console.log("  walletAddress (fee claimer from DB):", walletAddress);
    console.log("  signerWallet (localStorage):", signerWallet);
    console.log("  canClaim:", canClaim);
  }, [walletAddress, signerWallet, canClaim]);

  const fetchSolPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/sol-price");
      const data = await res.json();
      if (data.success && data.price) {
        setSolPrice(data.price);
      }
    } catch (e) {
      console.error("Failed to fetch SOL price:", e);
    }
  }, []);

  const fetchClaimable = useCallback(async () => {
    if (!tokenMint || !walletAddress) return;
    try {
      const res = await fetch(`/api/fees/claimable?tokenMint=${tokenMint}&wallet=${walletAddress}`);
      const data = await res.json();
      if (data.success) {
        setClaimable(parseInt(data.claimable || "0") / LAMPORTS_PER_SOL);
        setClaimed(parseInt(data.claimed || "0") / LAMPORTS_PER_SOL);
      }
    } catch (e) {
      console.error("Failed to fetch claimable fees:", e);
    }
  }, [tokenMint, walletAddress]);

  useEffect(() => {
    fetchClaimable();
    fetchSolPrice();
  }, [fetchClaimable, fetchSolPrice]);

  const formatUsd = (sol: number | null) => {
    if (sol === null || solPrice === null) return "—";
    const usd = sol * solPrice;
    return `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;
  };

  const handleClaim = async () => {
    if (!tokenMint || !walletAddress || claimable === 0) return;
    if (!canClaim) {
      setStatus("Wallet mismatch - cannot claim from different wallet");
      return;
    }
    setLoading(true);
    setStatus("Creating claim transaction...");

    try {
      const res = await fetch("/api/fees/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenMint, wallet: walletAddress }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Get transaction string - API returns array of transactions
      const txString = data.transaction || (data.transactions && data.transactions[0]);
      if (!txString) {
        throw new Error("No transaction returned from API");
      }

      console.log("Transaction string length:", txString.length);
      console.log("Transaction preview:", txString.substring(0, 50));

      setStatus("Signing transaction...");

      const keypair = getKeypair();
      if (!keypair) throw new Error("Wallet not found");

      // Verify keypair matches the fee claimer wallet
      const keypairPubkey = keypair.publicKey.toBase58();
      console.log("Keypair pubkey:", keypairPubkey);
      console.log("Expected fee claimer:", walletAddress);

      if (keypairPubkey !== walletAddress) {
        throw new Error(`Wallet mismatch! Your wallet: ${keypairPubkey.slice(0,8)}... Fee claimer: ${walletAddress.slice(0,8)}...`);
      }

      const connection = new Connection(RPC_URL, "confirmed");

      // Decode transaction - BagsAPI uses base58
      let txBytes: Uint8Array;
      try {
        // First try base58 (BagsAPI format)
        txBytes = bs58.decode(txString);
        console.log("Decoded as base58, bytes:", txBytes.length);
      } catch (e1) {
        console.log("Base58 decode failed:", e1);
        try {
          // Fallback to base64
          txBytes = Uint8Array.from(Buffer.from(txString, 'base64'));
          console.log("Decoded as base64, bytes:", txBytes.length);
        } catch (e2) {
          console.log("Base64 decode also failed:", e2);
          throw new Error(`Could not decode transaction: ${txString.substring(0, 30)}...`);
        }
      }

      const transaction = VersionedTransaction.deserialize(txBytes);
      transaction.sign([keypair]);

      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");

      setStatus(`Claimed! Tx: ${signature.slice(0, 8)}...`);
      setTimeout(fetchClaimable, 2000);
    } catch (error) {
      setStatus(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-300">Trading Fees</h4>
        <button
          onClick={fetchClaimable}
          className="text-xs text-gray-600 hover:text-gray-400 transition"
        >
          ↻
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-white/[0.02]">
          <p className="text-xs text-gray-500 mb-1">Claimable</p>
          <p className="text-lg font-mono font-medium text-green-400">
            {claimable !== null ? claimable.toFixed(6) : "—"} <span className="text-xs text-gray-500">SOL</span>
          </p>
          <p className="text-sm font-mono text-green-400/70">
            {formatUsd(claimable)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02]">
          <p className="text-xs text-gray-500 mb-1">Total Claimed</p>
          <p className="text-lg font-mono font-medium text-gray-400">
            {claimed !== null ? claimed.toFixed(6) : "—"} <span className="text-xs text-gray-500">SOL</span>
          </p>
          <p className="text-sm font-mono text-gray-500">
            {formatUsd(claimed)}
          </p>
        </div>
      </div>

      <button
        onClick={handleClaim}
        disabled={loading || claimable === null || claimable === 0 || !canClaim}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? "Claiming..." : !canClaim ? "Wrong wallet" : claimable === 0 ? "No fees to claim" : "Claim Fees"}
      </button>

      {!canClaim && claimable !== null && claimable > 0 && (
        <p className="mt-2 text-xs text-center text-yellow-400">
          Use the original wallet to claim fees
        </p>
      )}

      {status && (
        <p className={`mt-2 text-xs text-center ${status.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
