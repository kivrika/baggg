"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePrivy } from "@privy-io/react-auth";

const TradePanel = dynamic(() => import("@/components/TradePanel"), { ssr: false });
const SendMessageModal = dynamic(() => import("@/components/SendMessageModal"), { ssr: false });
import { DBUser, ChatSettings } from "@/types";
import { getOrCreateWallet } from "@/lib/wallet";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: privyUser, authenticated } = usePrivy();
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);
  const [posts, setPosts] = useState<{ id: number; content: string; is_pinned: boolean; created_at: string }[]>([]);
  const [pinning, setPinning] = useState(false);

  // Initialize wallet
  useEffect(() => {
    try {
      const wallet = getOrCreateWallet();
      setCurrentWallet(wallet.publicKey);
    } catch (e) {
      console.error("Failed to get wallet:", e);
    }
  }, []);

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

  // Fetch chat settings when user is loaded
  useEffect(() => {
    if (user?.token_mint) {
      fetch(`/api/chat/settings?username=${username}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setChatSettings(data.settings);
          }
        })
        .catch(console.error);
    }
  }, [user?.token_mint, username]);

  // Fetch posts for profile
  const fetchPosts = () => {
    if (user?.token_mint) {
      fetch(`/api/posts/user?username=${username}&limit=3`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPosts(data.posts);
          }
        })
        .catch(console.error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [user?.token_mint, username]);

  const handlePinToggle = async (postId: number, isPinned: boolean) => {
    if (!privyUser?.id) return;
    setPinning(true);
    try {
      const res = await fetch("/api/posts/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: privyUser.id,
          postId,
          action: isPinned ? "unpin" : "pin",
        }),
      });
      if (res.ok) {
        fetchPosts();
      }
    } catch (e) {
      console.error("Failed to pin/unpin:", e);
    } finally {
      setPinning(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Check if viewing own profile
  const isOwnProfile = authenticated && privyUser?.twitter?.username === username;

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
  const canMessage = hasCoin && !isOwnProfile && authenticated && chatSettings?.is_enabled !== false;
  const minTokenAmount = chatSettings ? parseFloat(chatSettings.min_token_amount) : 0;

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

          {/* Posts Section */}
          {hasCoin && posts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Posts</h3>
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className={`p-4 rounded-xl border transition ${
                      post.is_pinned
                        ? "bg-violet-500/5 border-violet-500/20"
                        : "bg-white/[0.02] border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {post.is_pinned && (
                          <span className="text-xs text-violet-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M16 4a1 1 0 01.117 1.993L16 6v4.586l3.707 3.707a1 1 0 01.083 1.32l-.083.094-1.414 1.414a1 1 0 01-1.32.083l-.094-.083L13.586 14H12v6a1 1 0 01-1.993.117L10 20v-6H8.414l-3.293 3.293a1 1 0 01-1.497-1.32l.083-.094L7.414 12 4.707 9.293a1 1 0 01-.083-1.32l.083-.094 1.414-1.414a1 1 0 011.32-.083l.094.083L11 9.879V6a1 1 0 01.883-.993L12 5h4z"/>
                            </svg>
                            Pinned
                          </span>
                        )}
                        <span className="text-xs text-gray-600">{formatTimeAgo(post.created_at)}</span>
                      </div>
                      {isOwnProfile && (
                        <button
                          onClick={() => handlePinToggle(post.id, post.is_pinned)}
                          disabled={pinning}
                          className={`text-xs px-2 py-1 rounded transition ${
                            post.is_pinned
                              ? "text-violet-400 hover:text-violet-300"
                              : "text-gray-600 hover:text-gray-400"
                          }`}
                        >
                          {post.is_pinned ? "Unpin" : "Pin"}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                      {post.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send Message Button */}
      {canMessage && (
        <div className="mt-6">
          <button
            onClick={() => setShowMessageModal(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Send Message
            {minTokenAmount > 0 && (
              <span className="text-xs opacity-75">
                (requires {minTokenAmount} {user.token_symbol})
              </span>
            )}
          </button>
        </div>
      )}

      {/* Trade Panel */}
      {hasCoin && (
        <div className="mt-6">
          <TradePanel
            tokenMint={user.token_mint!}
            tokenSymbol={user.token_symbol || user.twitter_username}
          />
        </div>
      )}

      {/* Send Message Modal */}
      {hasCoin && privyUser?.id && (
        <SendMessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          recipientUsername={user.twitter_username}
          recipientTokenMint={user.token_mint!}
          recipientTokenSymbol={user.token_symbol || user.twitter_username}
          minTokenAmount={minTokenAmount}
          senderPrivyId={privyUser.id}
          senderWallet={currentWallet}
        />
      )}
    </div>
  );
}
