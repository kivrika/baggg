"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const TradePanel = dynamic(() => import("@/components/TradePanel"), { ssr: false });
import { DBUser } from "@/types";

export default function TradePage() {
  const params = useParams();
  const mint = params.mint as string;
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const found = data.users.find((u: DBUser) => u.token_mint === mint);
          setUser(found || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mint]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-6 inline-block">
        &larr; Back
      </Link>

      {user && (
        <div className="flex items-center gap-3 mb-6">
          <img
            src={user.twitter_pfp || "/default-avatar.png"}
            alt={user.twitter_username}
            className="w-10 h-10 rounded-full bg-gray-700"
          />
          <div>
            <p className="font-semibold">{user.twitter_name || user.twitter_username}</p>
            <p className="text-sm text-gray-400">@{user.twitter_username}</p>
          </div>
        </div>
      )}

      <TradePanel
        tokenMint={mint}
        tokenSymbol={user?.token_symbol || mint.slice(0, 6)}
      />
    </div>
  );
}
