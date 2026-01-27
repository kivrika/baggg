"use client";

import Link from "next/link";
import { DBUser } from "@/types";

export default function UserCard({ user }: { user: DBUser }) {
  const hasCoin = !!user.token_mint;

  return (
    <Link
      href={`/profile/${user.twitter_username}`}
      className="group relative block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-violet-500/30 transition-all duration-300"
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 to-fuchsia-500/0 group-hover:from-violet-500/5 group-hover:to-fuchsia-500/5 transition-all duration-300" />

      <div className="relative">
        {/* Avatar + Info */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full p-[2px] ${hasCoin ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" : "bg-gray-700"}`}>
              <img
                src={user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
                alt={user.twitter_username}
                className="w-full h-full rounded-full object-cover bg-gray-800"
              />
            </div>
            {hasCoin && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-black" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
              {user.twitter_name || user.twitter_username}
            </p>
            <p className="text-sm text-gray-500">@{user.twitter_username}</p>
          </div>
        </div>

        {/* Token Badge */}
        <div className="mt-4 flex items-center justify-between">
          {hasCoin ? (
            <>
              <span className="text-xs font-semibold font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
                {user.token_symbol}
              </span>
              <span className="text-[11px] text-gray-600 font-mono">
                {user.token_mint!.slice(0, 4)}...{user.token_mint!.slice(-4)}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-700 italic">No coin yet</span>
          )}
        </div>
      </div>
    </Link>
  );
}
