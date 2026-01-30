"use client";

import Link from "next/link";
import { DBUser } from "@/types";

interface UserCardProps {
  user: DBUser;
  marketCap?: string | null;
}

export default function UserCard({ user, marketCap }: UserCardProps) {
  const hasCoin = !!user.token_mint;

  return (
    <Link
      href={`/profile/${user.twitter_username}`}
      className="group relative block rounded-2xl glass-card p-5 hover-lift gradient-border overflow-hidden"
    >
      {/* Animated background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-fuchsia-500/0 to-pink-500/0 group-hover:from-violet-500/5 group-hover:via-fuchsia-500/5 group-hover:to-pink-500/5 transition-all duration-500" />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 animate-shimmer" />
      </div>

      <div className="relative">
        {/* Avatar + Info */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-14 h-14 rounded-xl p-[2px] ${hasCoin ? "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500" : "bg-gray-700/50"} transition-all duration-300 group-hover:scale-105`}>
              <img
                src={user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
                alt={user.twitter_username || "User"}
                className="w-full h-full rounded-[10px] object-cover bg-gray-800"
              />
            </div>
            {hasCoin && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-[#0a0a0a] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white truncate group-hover:text-gradient transition-all duration-300">
              {user.twitter_name || user.twitter_username}
            </p>
            <p className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors">
              @{user.twitter_username}
            </p>
          </div>
          {/* Arrow indicator */}
          <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Token Badge */}
        <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
          {hasCoin ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-violet-300">$</span>
                </div>
                <span className="text-sm font-semibold font-mono text-violet-300">
                  {user.token_symbol}
                </span>
              </div>
              {marketCap ? (
                <span className="text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  {marketCap}
                </span>
              ) : (
                <span className="text-xs text-gray-600 font-mono bg-white/[0.03] px-2 py-1 rounded">
                  {user.token_mint!.slice(0, 4)}...{user.token_mint!.slice(-4)}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs italic">No coin launched</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
