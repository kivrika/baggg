"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { getOrCreateWallet } from "@/lib/wallet";

interface Holding {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string | null;
  ownerUsername: string;
  ownerName: string | null;
  ownerPfp: string | null;
  balance: number;
  decimals: number;
  rawAmount: string;
  totalBought: number;
  totalSold: number;
  totalSpent: number;
  totalReceived: number;
  avgBuyPrice: number;
  realizedPnL: number;
  currentPrice?: number;
  currentValue?: number;
  unrealizedPnL?: number;
}

export default function PortfolioPage() {
  const { authenticated, user } = usePrivy();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    const wallet = getOrCreateWallet();
    setWalletAddress(wallet.publicKey);
  }, []);

  const fetchSolBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/balance?address=${walletAddress}`);
      const data = await res.json();
      if (data.success) {
        setSolBalance(data.balance);
      }
    } catch (e) {
      console.error("Failed to fetch SOL balance:", e);
    }
  }, [walletAddress]);

  const fetchSolPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/sol-price");
      const data = await res.json();
      if (data.success) {
        setSolPrice(data.price);
      }
    } catch (e) {
      console.error("Failed to fetch SOL price:", e);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const url = user?.id
        ? `/api/portfolio?wallet=${walletAddress}&privyId=${user.id}`
        : `/api/portfolio?wallet=${walletAddress}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Fetch current sell values for each holding using quote API
        const holdingsWithValues = await Promise.all(
          data.holdings.map(async (h: Holding) => {
            try {
              // Get sell quote for the token balance (how much SOL we'd get)
              // Use rawAmount directly - it's already in the correct smallest units
              const quoteRes = await fetch(
                `/api/trade/quote?tokenMint=${h.tokenMint}&amount=${h.rawAmount}&side=sell`
              );
              const quoteData = await quoteRes.json();

              if (quoteData.success && quoteData.quote?.outAmount) {
                // outAmount is in lamports, convert to SOL
                const currentValue = Number(quoteData.quote.outAmount) / 1_000_000_000;
                const currentPrice = h.balance > 0 ? currentValue / h.balance : 0;
                const costBasis = h.totalSpent; // Use actual total spent
                const unrealizedPnL = currentValue - costBasis;

                return {
                  ...h,
                  currentPrice,
                  currentValue,
                  unrealizedPnL,
                };
              }
            } catch (e) {
              console.error(`Failed to get quote for ${h.tokenMint}:`, e);
            }

            // Fallback: no value data
            return {
              ...h,
              currentPrice: 0,
              currentValue: 0,
              unrealizedPnL: 0,
            };
          })
        );

        setHoldings(holdingsWithValues);
      }
    } catch (e) {
      console.error("Failed to fetch portfolio:", e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, user?.id]);

  useEffect(() => {
    if (walletAddress) {
      fetchPortfolio();
      fetchSolBalance();
      fetchSolPrice();
    }
  }, [walletAddress, fetchPortfolio, fetchSolBalance, fetchSolPrice]);

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const totalUnrealizedPnL = holdings.reduce((sum, h) => sum + (h.unrealizedPnL || 0), 0);
  const totalRealizedPnL = holdings.reduce((sum, h) => sum + h.realizedPnL, 0);

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  const formatUSD = (sol: number) => {
    if (!solPrice) return null;
    return `$${(sol * solPrice).toFixed(2)}`;
  };

  if (!authenticated) {
    return (
      <div className="animate-fade-in-up max-w-4xl mx-auto">
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Login to view portfolio</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Connect with X to see your token holdings and P&L
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Portfolio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your FriendBags token holdings
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {/* SOL Balance */}
        <div className="p-4 rounded-2xl glass-card">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">SOL Balance</p>
          <p className="text-xl font-bold text-white">
            {solBalance !== null ? solBalance.toFixed(4) : "—"}
          </p>
          {solBalance !== null && solPrice && (
            <p className="text-xs text-gray-500 mt-1">
              {formatUSD(solBalance)}
            </p>
          )}
        </div>

        {/* Portfolio Value */}
        <div className="p-4 rounded-2xl glass-card">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Token Value</p>
          <p className="text-xl font-bold text-white">
            {formatNumber(totalPortfolioValue, 4)} SOL
          </p>
          {solPrice && (
            <p className="text-xs text-gray-500 mt-1">
              {formatUSD(totalPortfolioValue)}
            </p>
          )}
        </div>

        {/* Unrealized P&L */}
        <div className="p-4 rounded-2xl glass-card">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Unrealized P&L</p>
          <p className={`text-xl font-bold ${totalUnrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalUnrealizedPnL >= 0 ? "+" : ""}{formatNumber(totalUnrealizedPnL, 4)} SOL
          </p>
          {solPrice && (
            <p className={`text-xs mt-1 ${totalUnrealizedPnL >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
              {totalUnrealizedPnL >= 0 ? "+" : ""}{formatUSD(totalUnrealizedPnL)}
            </p>
          )}
        </div>

        {/* Realized P&L */}
        <div className="p-4 rounded-2xl glass-card">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Realized P&L</p>
          <p className={`text-xl font-bold ${totalRealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalRealizedPnL >= 0 ? "+" : ""}{formatNumber(totalRealizedPnL, 4)} SOL
          </p>
          {solPrice && (
            <p className={`text-xs mt-1 ${totalRealizedPnL >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
              {totalRealizedPnL >= 0 ? "+" : ""}{formatUSD(totalRealizedPnL)}
            </p>
          )}
        </div>
      </div>

      {/* Holdings */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No tokens yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Start trading to build your portfolio
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
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Token</div>
            <div className="col-span-2 text-right">Balance</div>
            <div className="col-span-2 text-right">Value</div>
            <div className="col-span-2 text-right">Avg Buy</div>
            <div className="col-span-2 text-right">P&L</div>
          </div>

          {holdings.map((holding) => (
            <Link
              key={holding.tokenMint}
              href={`/profile/${holding.ownerUsername}`}
              className="block p-4 rounded-2xl glass-card border border-white/[0.04] hover:border-white/[0.08] transition"
            >
              <div className="sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                {/* Token Info */}
                <div className="col-span-4 flex items-center gap-3 mb-3 sm:mb-0">
                  {holding.ownerPfp ? (
                    <img
                      src={holding.ownerPfp}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                  )}
                  <div>
                    <p className="font-semibold text-white">
                      ${holding.tokenSymbol}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{holding.ownerUsername}
                    </p>
                  </div>
                </div>

                {/* Mobile: Stats Grid */}
                <div className="grid grid-cols-2 gap-3 sm:hidden mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(holding.balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Value</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(holding.currentValue || 0, 4)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Buy</p>
                    <p className="text-sm font-medium text-white">
                      {holding.avgBuyPrice > 0
                        ? `${holding.avgBuyPrice.toFixed(6)} SOL`
                        : <span className="text-gray-600 text-xs">No data</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Unrealized P&L</p>
                    <p className={`text-sm font-medium ${(holding.unrealizedPnL || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(holding.unrealizedPnL || 0) >= 0 ? "+" : ""}{formatNumber(holding.unrealizedPnL || 0, 4)}
                    </p>
                  </div>
                </div>

                {/* Desktop: Columns */}
                <div className="hidden sm:block col-span-2 text-right">
                  <p className="font-medium text-white">{formatNumber(holding.balance)}</p>
                </div>
                <div className="hidden sm:block col-span-2 text-right">
                  <p className="font-medium text-white">{formatNumber(holding.currentValue || 0, 4)} SOL</p>
                  {solPrice && holding.currentValue && (
                    <p className="text-xs text-gray-500">{formatUSD(holding.currentValue)}</p>
                  )}
                </div>
                <div className="hidden sm:block col-span-2 text-right">
                  <p className="font-medium text-white">
                    {holding.avgBuyPrice > 0
                      ? `${holding.avgBuyPrice.toFixed(6)} SOL`
                      : <span className="text-gray-600 text-sm">No data</span>}
                  </p>
                </div>
                <div className="hidden sm:block col-span-2 text-right">
                  <p className={`font-medium ${(holding.unrealizedPnL || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(holding.unrealizedPnL || 0) >= 0 ? "+" : ""}{formatNumber(holding.unrealizedPnL || 0, 4)} SOL
                  </p>
                  {holding.realizedPnL !== 0 && (
                    <p className={`text-xs ${holding.realizedPnL >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                      Realized: {holding.realizedPnL >= 0 ? "+" : ""}{formatNumber(holding.realizedPnL, 4)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center mt-8">
        <button
          onClick={() => {
            fetchPortfolio();
            fetchSolBalance();
          }}
          className="px-6 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-gray-400 hover:text-white transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
