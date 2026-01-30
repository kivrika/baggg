"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TradeWithUser } from "@/types";

export default function ActivityPage() {
  const [trades, setTrades] = useState<TradeWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades?limit=100");
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
      }
    } catch (e) {
      console.error("Failed to fetch trades:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    // Poll for new trades every 10 seconds
    const interval = setInterval(fetchTrades, 10000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  const formatSOL = (amount: number) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(2) + "M";
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(2) + "K";
    }
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="animate-fade-in-up max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Activity</h1>
          <p className="text-sm text-gray-500 mt-1">
            Recent trades on FriendBags
          </p>
        </div>
        <button
          onClick={fetchTrades}
          className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No trades yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Be the first to trade on FriendBags
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition"
          >
            Explore Creators
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center gap-4 p-4 rounded-2xl glass-card border border-white/[0.04] hover:border-white/[0.08] transition"
            >
              {/* User Avatar */}
              <Link href={`/profile/${trade.twitter_username}`}>
                {trade.twitter_pfp ? (
                  <img
                    src={trade.twitter_pfp}
                    alt=""
                    className="w-12 h-12 rounded-full hover:ring-2 hover:ring-violet-500/50 transition"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                )}
              </Link>

              {/* Trade Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/profile/${trade.twitter_username}`}
                    className="font-semibold text-white hover:text-violet-300 transition truncate"
                  >
                    {trade.twitter_name || `@${trade.twitter_username}`}
                  </Link>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      trade.trade_type === "buy"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {trade.trade_type === "buy" ? "bought" : "sold"}
                  </span>
                  {trade.token_owner_username && (
                    <Link
                      href={`/profile/${trade.token_owner_username}`}
                      className="font-medium text-violet-400 hover:text-violet-300 transition"
                    >
                      ${trade.token_symbol || trade.token_owner_username}
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-gray-400">
                    {formatTokenAmount(trade.token_amount)} tokens
                  </span>
                  <span className="text-gray-600">for</span>
                  <span className="text-white font-medium">
                    {formatSOL(trade.sol_amount)} SOL
                  </span>
                </div>
              </div>

              {/* Time & Link */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-gray-600">
                  {formatTime(trade.created_at)}
                </span>
                <a
                  href={`https://solscan.io/tx/${trade.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
                >
                  View tx
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
