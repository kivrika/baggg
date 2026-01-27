"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";

interface LaunchCoinButtonProps {
  onLaunched?: (tokenMint: string) => void;
}

export default function LaunchCoinButton({ onLaunched }: LaunchCoinButtonProps) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const wallet = wallets[0];

  const handleLaunch = async () => {
    if (!user || !wallet) return;
    setLoading(true);
    setStatus("Creating your coin...");

    try {
      const res = await fetch("/api/launch-coin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          walletAddress: wallet.address,
        }),
      });

      const data = await res.json();

      if (data.error === "User already has a coin") {
        setStatus("You already have a coin!");
        onLaunched?.(data.tokenMint);
        return;
      }

      if (!data.success) throw new Error(data.error);

      setStatus("Signing transaction...");
      const txBytes = Uint8Array.from(atob(data.transaction), (c) => c.charCodeAt(0));

      const { signature } = await signAndSendTransaction({
        wallet,
        transaction: txBytes,
      });

      setStatus(`Coin launched! ${data.tokenSymbol}`);
      onLaunched?.(data.tokenMint);
    } catch (error) {
      setStatus(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleLaunch}
        disabled={loading || !wallet}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Launching..." : "Launch Your Coin"}
      </button>
      {status && (
        <p className={`mt-2 text-sm text-center ${status.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
