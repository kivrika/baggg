"use client";

import { useEffect, useState, useCallback } from "react";
import UserCard from "@/components/UserCard";
import { DBUser } from "@/types";

export default function ExplorePage() {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marketCaps, setMarketCaps] = useState<Record<string, number>>({});
  const [loadingMarketCaps, setLoadingMarketCaps] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.users);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const filteredUsers = users
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().replace("@", "");
      return (
        u.twitter_username.toLowerCase().includes(query) ||
        (u.twitter_name && u.twitter_name.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      const mcA = a.token_mint ? (marketCaps[a.token_mint] || 0) : -1;
      const mcB = b.token_mint ? (marketCaps[b.token_mint] || 0) : -1;
      return mcB - mcA;
    });

  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
    if (mc > 0) return `$${mc.toFixed(0)}`;
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Explore Creators</h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover and invest in your favorite creators
          </p>
        </div>
        <div className="flex items-center gap-4">
          {usersWithCoins.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 bg-white/[0.03] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {usersWithCoins.length} coins live
            </span>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {users.length > 0 && (
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators by @username..."
            className="w-full pl-14 pr-12 py-4 rounded-2xl glass-card text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-white transition"
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
        <p className="text-sm text-gray-400 mb-6">
          Found <span className="text-white font-medium">{filteredUsers.length}</span> result{filteredUsers.length !== 1 ? "s" : ""} for "<span className="text-violet-400">{searchQuery}</span>"
        </p>
      )}

      {/* Creators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {filteredUsers.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            marketCap={u.token_mint ? formatMarketCap(marketCaps[u.token_mint] || 0) : null}
          />
        ))}
      </div>

      {loadingMarketCaps && usersWithCoins.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-500">
          <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm">Loading market data...</span>
        </div>
      )}

      {users.length === 0 && (
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No creators yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Be the first to join and launch your own social token on Solana</p>
        </div>
      )}

      {users.length > 0 && filteredUsers.length === 0 && searchQuery && (
        <div className="text-center py-16 rounded-3xl glass-card">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No results found</h3>
          <p className="text-gray-500 mb-4">No creators matching "<span className="text-violet-400">{searchQuery}</span>"</p>
          <button
            onClick={() => setSearchQuery("")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-sm font-medium transition-colors btn-press"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
