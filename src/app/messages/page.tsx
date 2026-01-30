"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { MessageWithSender, DBUser } from "@/types";

export default function MessagesPage() {
  const { ready, authenticated, user, login } = usePrivy();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DBUser | null>(null);

  // Fetch current user
  useEffect(() => {
    if (authenticated && user?.id) {
      fetch(`/api/auth/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          twitterUsername: user.twitter?.username,
          twitterName: user.twitter?.name,
          twitterPfp: user.twitter?.profilePictureUrl,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setCurrentUser(data.user);
        })
        .catch(console.error);
    }
  }, [authenticated, user?.id, user?.twitter]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/chat/messages?privyId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authenticated && user?.id) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [authenticated, user?.id, fetchMessages]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / (1000 * 60));
    return mins > 0 ? `${mins}m ago` : "now";
  };

  // Group messages by sender
  const groupedMessages = messages.reduce((acc, msg) => {
    if (!acc[msg.sender_username]) {
      acc[msg.sender_username] = {
        sender: {
          username: msg.sender_username,
          name: msg.sender_name,
          pfp: msg.sender_pfp,
        },
        messages: [],
        unreadCount: 0,
      };
    }
    acc[msg.sender_username].messages.push(msg);
    if (!msg.is_read) acc[msg.sender_username].unreadCount++;
    return acc;
  }, {} as Record<string, { sender: { username: string; name: string | null; pfp: string | null }; messages: MessageWithSender[]; unreadCount: number }>);

  const conversations = Object.values(groupedMessages);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="animate-fade-in-up">
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Sign in to view messages</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">Connect with Twitter to access your inbox</p>
          <button
            onClick={login}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Sign in with X
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser?.token_mint) {
    return (
      <div className="animate-fade-in-up">
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Launch your coin first</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">You need to launch a coin to receive messages from token holders</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition"
          >
            Launch Coin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Messages</h1>
          <p className="text-sm text-gray-500 mt-1">
            Messages from your token holders
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalUnread > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-full">
              {totalUnread} unread
            </span>
          )}
          <button
            onClick={fetchMessages}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No messages yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Token holders can message you once they hold enough of your tokens</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map(({ sender, messages: msgs, unreadCount }) => (
            <Link
              key={sender.username}
              href={`/profile/${sender.username}`}
              className="flex items-start gap-4 p-4 rounded-2xl glass-card hover:bg-white/[0.04] border border-white/[0.04] hover:border-violet-500/30 transition group"
            >
              {sender.pfp ? (
                <img src={sender.pfp} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white truncate group-hover:text-violet-300 transition">
                    {sender.name || `@${sender.username}`}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-500 text-xs font-medium text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {msgs[0].content.substring(0, 80)}{msgs[0].content.length > 80 ? "..." : ""}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {formatTime(msgs[0].created_at)} · {msgs.length} message{msgs.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
