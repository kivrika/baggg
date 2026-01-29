"use client";

import { useState, useEffect } from "react";

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientUsername: string;
  recipientTokenMint: string;
  recipientTokenSymbol: string;
  minTokenAmount: number;
  senderPrivyId: string;
  senderWallet: string | null;
}

export default function SendMessageModal({
  isOpen,
  onClose,
  recipientUsername,
  recipientTokenMint,
  recipientTokenSymbol,
  minTokenAmount,
  senderPrivyId,
  senderWallet,
}: SendMessageModalProps) {
  const [content, setContent] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && senderWallet && recipientTokenMint) {
      setCheckingBalance(true);
      fetch(`/api/token-balance?wallet=${senderWallet}&tokenMint=${recipientTokenMint}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setBalance(data.balance);
          }
        })
        .catch(console.error)
        .finally(() => setCheckingBalance(false));
    }
  }, [isOpen, senderWallet, recipientTokenMint]);

  const canSend = balance !== null && balance >= minTokenAmount;

  const handleSend = async () => {
    if (!content.trim() || !canSend) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: senderPrivyId,
          recipientUsername,
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatus("Message sent!");
      setContent("");
      setTimeout(() => {
        onClose();
        setStatus(null);
      }, 1500);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Failed to send"}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] rounded-2xl border border-white/[0.06] p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Message @{recipientUsername}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Token Requirement */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Required</span>
            <span className="text-white font-medium">
              {minTokenAmount} {recipientTokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-400">Your Balance</span>
            {checkingBalance ? (
              <span className="text-gray-500">Checking...</span>
            ) : balance !== null ? (
              <span className={canSend ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                {balance.toLocaleString()} {recipientTokenSymbol}
              </span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>

        {/* Insufficient Balance Warning */}
        {balance !== null && !canSend && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
            <p className="text-sm text-red-400">
              You need {minTokenAmount - balance} more {recipientTokenSymbol} to message this user.
            </p>
          </div>
        )}

        {/* Message Input */}
        <div className="mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            disabled={!canSend || loading}
            placeholder={canSend ? "Write your message..." : "Insufficient tokens"}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/40 resize-none h-32 disabled:opacity-50"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-gray-600">{content.length}/1000</span>
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!content.trim() || !canSend || loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>

        {/* Status Message */}
        {status && (
          <p className={`text-sm text-center mt-3 ${status.includes("Error") ? "text-red-400" : "text-green-400"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
