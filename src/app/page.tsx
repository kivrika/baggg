"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import UserCard from "@/components/UserCard";
import { DBUser } from "@/types";

const AuthSection = dynamic(() => import("@/components/AuthSection"), { ssr: false });

export default function Home() {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marketCaps, setMarketCaps] = useState<Record<string, number>>({});
  const [loadingMarketCaps, setLoadingMarketCaps] = useState(false);

  const fetchUsers = useCallback(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.users);
      })
      .catch(console.error);
  }, []);

  // Fetch market caps when users change
  const fetchMarketCaps = useCallback(async (userList: DBUser[]) => {
    const tokenMints = userList
      .filter((u) => u.token_mint)
      .map((u) => u.token_mint as string);

    if (tokenMints.length === 0) return;

    setLoadingMarketCaps(true);
    try {
      const res = await fetch("/api/market-cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenMints }),
      });
      const data = await res.json();
      if (data.success) {
        setMarketCaps(data.marketCaps);
      }
    } catch (e) {
      console.error("Failed to fetch market caps:", e);
    } finally {
      setLoadingMarketCaps(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (users.length > 0) {
      fetchMarketCaps(users);
    }
  }, [users, fetchMarketCaps]);

  const usersWithCoins = users.filter((u) => u.token_mint);

  // Filter users based on search query
  const filteredUsers = users
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().replace("@", "");
      return (
        u.twitter_username.toLowerCase().includes(query) ||
        (u.twitter_name && u.twitter_name.toLowerCase().includes(query))
      );
    })
    // Sort by market cap (highest first), users without coins at the end
    .sort((a, b) => {
      const mcA = a.token_mint ? (marketCaps[a.token_mint] || 0) : -1;
      const mcB = b.token_mint ? (marketCaps[b.token_mint] || 0) : -1;
      return mcB - mcA;
    });

  // Format market cap for display
  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
    if (mc > 0) return `$${mc.toFixed(0)}`;
    return null;
  };

  return (
    <div className="animate-fade-in-up">
      {/* Hero */}
      <div className="text-center mb-14 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          FriendBags on Solana
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Trade Social
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
            Tokens
          </span>
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
          Every creator gets a coin. Buy and sell social tokens on Solana.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{users.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">Creators</p>
          </div>
          <div className="w-px bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{usersWithCoins.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">Coins Live</p>
          </div>
        </div>
      </div>

      {/* Auth Section */}
      {process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
        process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "your_privy_app_id_here" && (
          <AuthSection onUserSynced={fetchUsers} />
      )}

      {/* Creators Grid */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-200">
            {users.length > 0 ? "Creators" : "No creators yet"}
          </h2>
          {users.length > 0 && (
            <span className="text-xs text-gray-600">{users.length} total</span>
          )}
        </div>

        {/* Search Bar */}
        {users.length > 0 && (
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @username..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.04] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Search Results Info */}
        {searchQuery && (
          <p className="text-sm text-gray-500 mb-4">
            {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""} for "{searchQuery}"
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              marketCap={u.token_mint ? formatMarketCap(marketCaps[u.token_mint] || 0) : null}
            />
          ))}
        </div>

        {loadingMarketCaps && usersWithCoins.length > 0 && (
          <p className="text-center text-xs text-gray-600 mt-4">Loading market caps...</p>
        )}

        {users.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.06]">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm">Be the first to join and launch a coin</p>
          </div>
        )}

        {users.length > 0 && filteredUsers.length === 0 && searchQuery && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-white/[0.06]">
            <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm">No users found for "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-3 text-violet-400 hover:text-violet-300 text-sm transition"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
