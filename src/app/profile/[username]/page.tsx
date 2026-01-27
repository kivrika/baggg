"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const TradePanel = dynamic(() => import("@/components/TradePanel"), { ssr: false });
import { DBUser } from "@/types";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const found = data.users.find(
            (u: DBUser) => u.twitter_username === username
          );
          setUser(found || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <p className="text-gray-400 text-lg mb-4">User not found</p>
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm transition">
          Back to home
        </Link>
      </div>
    );
  }

  const hasCoin = !!user.token_mint;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-300 mb-6 transition group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      {/* Profile Header */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-pink-600/20" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="relative -mt-10 mb-4">
            <div className={`w-20 h-20 rounded-full p-[3px] ${hasCoin ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" : "bg-gray-700"}`}>
              <img
                src={user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
                alt={user.twitter_username}
                className="w-full h-full rounded-full object-cover bg-gray-800 border-2 border-black"
              />
            </div>
            {hasCoin && (
              <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-black" />
            )}
          </div>

          {/* Name */}
          <h1 className="text-2xl font-bold text-white">
            {user.twitter_name || user.twitter_username}
          </h1>
          <a
            href={`https://x.com/${user.twitter_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-violet-400 transition text-sm"
          >
            @{user.twitter_username}
          </a>

          {/* Token Info */}
          {hasCoin ? (
            <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Token</span>
                <span className="font-semibold text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full text-sm">
                  {user.token_symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Mint Address</span>
                <span className="text-xs font-mono text-gray-600">
                  {user.token_mint!.slice(0, 8)}...{user.token_mint!.slice(-6)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <a
                  href={`https://solscan.io/token/${user.token_mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition"
                >
                  View on Solscan
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06] text-center">
              <p className="text-gray-600 text-sm">No coin launched yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Trade Panel */}
      {hasCoin && (
        <div className="mt-6">
          <TradePanel
            tokenMint={user.token_mint!}
            tokenSymbol={user.token_symbol || user.twitter_username}
          />
        </div>
      )}
    </div>
  );
}
