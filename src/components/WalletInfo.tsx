"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrCreateWallet, getKeypair, StoredWallet } from "@/lib/wallet";
import { Transaction } from "@solana/web3.js";

export default function WalletInfo() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Withdraw state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Initialize wallet on mount
  useEffect(() => {
    const w = getOrCreateWallet();
    setWallet(w);
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.publicKey) return;

    try {
      const res = await fetch(`/api/balance?address=${wallet.publicKey}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error("Balance fetch error:", error);
      setBalance(0);
    }
  }, [wallet?.publicKey]);

  // Fetch SOL balance
  useEffect(() => {
    if (!wallet?.publicKey) return;

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [wallet?.publicKey, fetchBalance]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  const copyAddress = () => {
    if (!wallet?.publicKey) return;
    navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPrivateKey = () => {
    if (!wallet?.secretKey) return;
    navigator.clipboard.writeText(wallet.secretKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleExportWallet = () => {
    setShowExportModal(true);
    setShowPrivateKey(false);
  };

  const closeModal = () => {
    setShowExportModal(false);
    setShowPrivateKey(false);
    setKeyCopied(false);
  };

  // Withdraw handlers
  const openWithdrawModal = () => {
    setShowWithdrawModal(true);
    setWithdrawAddress("");
    setWithdrawAmount("");
    setWithdrawError(null);
    setWithdrawSuccess(null);
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    setWithdrawAddress("");
    setWithdrawAmount("");
    setWithdrawError(null);
    setWithdrawSuccess(null);
  };

  const setMaxAmount = () => {
    if (balance !== null) {
      // Leave 0.001 SOL for fees
      const maxAmount = Math.max(0, balance - 0.001);
      setWithdrawAmount(maxAmount.toFixed(6));
    }
  };

  const handleWithdraw = async () => {
    if (!wallet?.publicKey || !withdrawAddress || !withdrawAmount) return;

    setWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    try {
      // Create withdraw transaction
      const createRes = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWallet: wallet.publicKey,
          toAddress: withdrawAddress,
          amount: withdrawAmount,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || "Failed to create transaction");
      }

      // Sign transaction client-side
      const keypair = getKeypair();
      if (!keypair) {
        throw new Error("Failed to get wallet keypair");
      }

      const txBuffer = Buffer.from(createData.transaction, "base64");
      const transaction = Transaction.from(txBuffer);
      transaction.sign(keypair);

      // Send signed transaction
      const signedTx = transaction.serialize();
      const sendRes = await fetch("/api/withdraw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx).toString("base64"),
        }),
      });

      const sendData = await sendRes.json();
      if (!sendData.success) {
        throw new Error(sendData.error || "Failed to send transaction");
      }

      setWithdrawSuccess(sendData.signature);
      // Refresh balance after successful withdrawal
      setTimeout(fetchBalance, 2000);
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  if (!wallet) return null;

  const shortAddress = `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`;

  return (
    <div className="max-w-md mx-auto mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Your Solana Wallet</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50"
            title="Refresh balance"
          >
            {refreshing ? "..." : "↻"}
          </button>
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
          <p className="text-xs font-mono text-gray-400 break-all select-all">{wallet.publicKey}</p>
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
          onClick={openWithdrawModal}
          disabled={balance === null || balance <= 0}
          className="flex-1 py-2 px-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-sm text-green-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Withdraw
        </button>
        <button
          onClick={handleExportWallet}
          className="flex-1 py-2 px-3 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-sm text-violet-300 transition"
        >
          Export Key
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-3">Export Private Key</h3>

            {!showPrivateKey ? (
              <>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                  <p className="text-sm text-red-400 font-medium">Warning!</p>
                  <p className="text-xs text-red-300 mt-1">
                    Never share your private key with anyone. Anyone with this key can access your funds.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowPrivateKey(true)}
                    className="flex-1 py-2 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-sm text-white font-medium transition"
                  >
                    Show Private Key
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-black/50 border border-white/10 mb-4">
                  <p className="text-xs text-gray-500 mb-2">Your Private Key (Base58):</p>
                  <p className="text-xs font-mono text-white break-all select-all">
                    {wallet.secretKey}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyPrivateKey}
                    className="flex-1 py-2 px-4 rounded-lg bg-violet-500 hover:bg-violet-600 text-sm text-white font-medium transition"
                  >
                    {keyCopied ? "Copied!" : "Copy Key"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Withdraw SOL</h3>

            {withdrawSuccess ? (
              <>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                  <p className="text-sm text-green-400 font-medium">Withdrawal Successful!</p>
                  <a
                    href={`https://solscan.io/tx/${withdrawSuccess}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-300 hover:underline mt-1 block break-all"
                  >
                    View transaction →
                  </a>
                </div>
                <button
                  onClick={closeWithdrawModal}
                  className="w-full py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                {/* Available Balance */}
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-gray-500">Available Balance</p>
                  <p className="text-lg font-semibold text-white">
                    {balance?.toFixed(6) || "0"} SOL
                  </p>
                </div>

                {/* Destination Address */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Destination Address</label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="Enter Solana wallet address"
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>

                {/* Amount */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Amount (SOL)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.001"
                      min="0"
                      className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      onClick={setMaxAmount}
                      className="px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-xs text-violet-300 transition"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Error */}
                {withdrawError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{withdrawError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={closeWithdrawModal}
                    disabled={withdrawing}
                    className="flex-1 py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="flex-1 py-2 px-4 rounded-lg bg-green-500 hover:bg-green-600 text-sm text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawing ? "Sending..." : "Withdraw"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Solscan Link */}
      <div className="mt-3 text-center">
        <a
          href={`https://solscan.io/account/${wallet.publicKey}`}
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
