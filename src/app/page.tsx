"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
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
      <div className="text-center mb-16 pt-8 relative">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative">
          <h1 className="text-5xl sm:text-7xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-b from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Trade Social
            </span>
            <br />
            <span className="text-gradient animate-gradient">
              Tokens
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed mb-10">
            Every creator gets a coin. Buy, sell, and earn from social tokens on Solana.
          </p>

          {/* Stats */}
          <div className="inline-flex items-center gap-6 sm:gap-10 px-6 py-4 rounded-2xl glass-card mb-10">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gradient">{users.length}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Creators</p>
            </div>
            <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gradient">{usersWithCoins.length}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Coins Live</p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-lg transition shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              Explore Creators
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Auth Section */}
      {process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
        process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "your_privy_app_id_here" && (
          <AuthSection onUserSynced={fetchUsers} />
      )}
    </div>
  );
}
