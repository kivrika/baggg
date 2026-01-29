"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageWithSender } from "@/types";
import Link from "next/link";

interface MessageInboxProps {
  privyId: string;
}

export default function MessageInbox({ privyId }: MessageInboxProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?privyId=${privyId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    } finally {
      setLoading(false);
    }
  }, [privyId]);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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

  if (loading) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Inbox</h3>
        <button
          onClick={fetchMessages}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">No messages yet</p>
          <p className="text-xs text-gray-700 mt-1">Token holders can message you</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {conversations.map(({ sender, messages: msgs, unreadCount }) => (
            <Link
              key={sender.username}
              href={`/profile/${sender.username}`}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-violet-500/30 transition"
            >
              {sender.pfp ? (
                <img src={sender.pfp} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {sender.name || `@${sender.username}`}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-[10px] font-medium text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {msgs[0].content.substring(0, 50)}{msgs[0].content.length > 50 ? "..." : ""}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">
                  {formatTime(msgs[0].created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
