"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function Navbar() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const twitterUsername = user?.twitter?.username;
  const twitterPfp = user?.twitter?.profilePictureUrl;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <img src="/fbags.png" alt="FriendBags" className="h-8 w-auto" />
          <span className="text-lg font-semibold text-white">FriendBags</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Navigation Links */}
          <Link
          href="/explore"
          className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          Explore
        </Link>
        <Link
          href="/messages"
          className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          Messages
        </Link>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.1] mx-1" />

        {/* Auth */}
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
