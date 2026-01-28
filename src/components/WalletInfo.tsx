"use client";

import { useState, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";

export default function WalletInfo() {
  const { wallets } = useWallets();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const wallet = wallets[0];

  // Fetch SOL balance
  useEffect(() => {
    if (!wallet?.address) return;

    const fetchBalance = async () => {
      try {
        const connection = new Connection(RPC_URL, "confirmed");
        const pubkey = new PublicKey(wallet.address);
        const lamports = await connection.getBalance(pubkey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(0);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [wallet?.address]);

  const copyAddress = () => {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportWallet = () => {
    // Privy's exportWallet only works for Ethereum wallets
    // For Solana, redirect to Privy Home where users can export
    window.open("https://home.privy.io/settings/wallets", "_blank");
  };

  if (!wallet) return null;

  const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

  return (
    <div className="max-w-md mx-auto mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Your Solana Wallet</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            balance !== null && balance > 0
              ? "bg-green-500/20 text-green-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}>
            {balance !== null ? `${balance.toFixed(4)} SOL` : "Loading..."}
          </span>
        </div>
      </div>

      {/* Wallet Address */}
      <div className="flex items-center gap-2 mb-3">
        <div
          onClick={copyAddress}
          className="flex-1 bg-black/30 rounded-lg px-3 py-2 font-mono text-sm cursor-pointer hover:bg-black/50 transition"
        >
          <span className="text-gray-400">{shortAddress}</span>
          <span className="text-xs text-gray-600 ml-2">(click to copy)</span>
        </div>
        {copied && (
          <span className="text-xs text-green-400">Copied!</span>
        )}
      </div>

      {/* Full Address (expandable) */}
      <details className="mb-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
          Show full address
        </summary>
        <div className="mt-2 p-2 bg-black/30 rounded-lg">
          <p className="text-xs font-mono text-gray-400 break-all select-all">{wallet.address}</p>
        </div>
      </details>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={copyAddress}
          className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
        >
          Copy Address
        </button>
        <button
          onClick={handleExportWallet}
          className="flex-1 py-2 px-3 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-sm text-violet-300 transition"
        >
          Export Key
        </button>
      </div>

      {/* Solscan Link */}
      <div className="mt-3 text-center">
        <a
          href={`https://solscan.io/account/${wallet.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          View on Solscan →
        </a>
      </div>

      {/* Funding Notice */}
      {balance !== null && balance < 0.01 && (
        <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-400">
            <strong>Fund your wallet:</strong> Send at least 0.02 SOL (~$3) to launch your coin.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Copy the address above and send SOL from any exchange or wallet.
          </p>
        </div>
      )}
    </div>
  );
}
