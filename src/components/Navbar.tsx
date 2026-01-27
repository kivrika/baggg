"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function Navbar() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const twitterUsername = user?.twitter?.username;
  const twitterPfp = user?.twitter?.profilePictureUrl;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm group-hover:scale-105 transition-transform">
            F
          </div>
          <span className="text-lg font-bold text-white">
            Friend<span className="text-violet-400">Bags</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {ready && authenticated ? (
            <>
              {twitterUsername && (
                <Link
                  href={`/profile/${twitterUsername}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] transition"
                >
                  {twitterPfp && (
                    <img src={twitterPfp} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-sm text-gray-300">@{twitterUsername}</span>
                </Link>
              )}
              <button
                onClick={logout}
                className="text-sm px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-gray-400 hover:text-white transition"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={login}
              disabled={!ready}
              className="text-sm px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition disabled:opacity-50 shadow-lg shadow-violet-500/20"
            >
              Login with X
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
