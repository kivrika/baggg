"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import UserCard from "@/components/UserCard";
import { DBUser } from "@/types";

const AuthSection = dynamic(() => import("@/components/AuthSection"), { ssr: false });

export default function Home() {
  const [users, setUsers] = useState<DBUser[]>([]);

  const fetchUsers = useCallback(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.users);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const usersWithCoins = users.filter((u) => u.token_mint);

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
          <div className="w-px bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-2xl font-bold text-violet-400">SOL</p>
            <p className="text-xs text-gray-600 mt-0.5">Network</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {users.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>

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
      </div>
    </div>
  );
}
