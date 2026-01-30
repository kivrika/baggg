"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { DBUser, Message, ChatSettings } from "@/types";
import { getOrCreateWallet } from "@/lib/wallet";

export default function ChatPage() {
  const params = useParams();
  const username = params.username as string;
  const { user: privyUser, authenticated, ready, login } = usePrivy();

  const [otherUser, setOtherUser] = useState<DBUser | null>(null);
  const [currentUser, setCurrentUser] = useState<DBUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherChatSettings, setOtherChatSettings] = useState<ChatSettings | null>(null);
  const [myChatSettings, setMyChatSettings] = useState<ChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [myBalanceOfTheirToken, setMyBalanceOfTheirToken] = useState<number | null>(null);
  const [theirBalanceOfMyToken, setTheirBalanceOfMyToken] = useState<number | null>(null);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize wallet
  useEffect(() => {
    try {
      const wallet = getOrCreateWallet();
      setCurrentWallet(wallet.publicKey);
    } catch (e) {
      console.error("Failed to get wallet:", e);
    }
  }, []);

  // Fetch current user
  useEffect(() => {
    if (authenticated && privyUser?.id) {
      fetch(`/api/auth/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: privyUser.id,
          twitterUsername: privyUser.twitter?.username,
          twitterName: privyUser.twitter?.name,
          twitterPfp: privyUser.twitter?.profilePictureUrl,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setCurrentUser(data.user);
        })
        .catch(console.error);
    }
  }, [authenticated, privyUser?.id, privyUser?.twitter]);

  // Fetch other user
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const found = data.users.find(
            (u: DBUser) => u.twitter_username === username
          );
          setOtherUser(found || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [username]);

  // Fetch other user's chat settings
  useEffect(() => {
    if (otherUser?.token_mint) {
      fetch(`/api/chat/settings?username=${username}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setOtherChatSettings(data.settings);
          }
        })
        .catch(console.error);
    }
  }, [otherUser?.token_mint, username]);

  // Fetch my chat settings
  useEffect(() => {
    if (currentUser?.token_mint && privyUser?.twitter?.username) {
      fetch(`/api/chat/settings?username=${privyUser.twitter.username}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMyChatSettings(data.settings);
          }
        })
        .catch(console.error);
    }
  }, [currentUser?.token_mint, privyUser?.twitter?.username]);

  // Fetch my balance of their token
  useEffect(() => {
    if (currentWallet && otherUser?.token_mint) {
      fetch(`/api/token-balance?wallet=${currentWallet}&tokenMint=${otherUser.token_mint}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMyBalanceOfTheirToken(data.balance);
          }
        })
        .catch(console.error);
    }
  }, [currentWallet, otherUser?.token_mint]);

  // Fetch their balance of my token
  useEffect(() => {
    if (otherUser?.wallet_address && currentUser?.token_mint) {
      fetch(`/api/token-balance?wallet=${otherUser.wallet_address}&tokenMint=${currentUser.token_mint}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTheirBalanceOfMyToken(data.balance);
          }
        })
        .catch(console.error);
    }
  }, [otherUser?.wallet_address, currentUser?.token_mint]);

  // Fetch conversation
  const fetchMessages = useCallback(async () => {
    if (!privyUser?.id || !username) return;

    try {
      const res = await fetch(`/api/chat/conversation?privyId=${privyUser.id}&otherUsername=${username}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  }, [privyUser?.id, username]);

  useEffect(() => {
    if (authenticated && privyUser?.id) {
      fetchMessages();
      // Poll for new messages every 5 seconds
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, privyUser?.id, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const theirMinTokenAmount = otherChatSettings ? parseFloat(otherChatSettings.min_token_amount) : 0;
  const myMinTokenAmount = myChatSettings ? parseFloat(myChatSettings.min_token_amount) : 0;

  // Check if user can send messages - BIDIRECTIONAL CHECK
  // Case 1: I hold enough of their tokens
  const iHoldEnoughOfTheirTokens = otherUser?.token_mint &&
    myBalanceOfTheirToken !== null &&
    myBalanceOfTheirToken >= theirMinTokenAmount;

  // Case 2: They hold enough of my tokens
  const theyHoldEnoughOfMyTokens = currentUser?.token_mint &&
    theirBalanceOfMyToken !== null &&
    theirBalanceOfMyToken >= myMinTokenAmount;

  // Can send if either condition is met
  const canSend = iHoldEnoughOfTheirTokens || theyHoldEnoughOfMyTokens;

  const handleSend = async () => {
    if (!newMessage.trim() || !privyUser?.id || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: privyUser.id,
          recipientUsername: username,
          content: newMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      setNewMessage("");
      fetchMessages();
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

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
          <h3 className="text-xl font-semibold text-white mb-2">Sign in to chat</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">Connect with Twitter to message this creator</p>
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <p className="text-gray-400 text-lg mb-4">User not found</p>
        <Link href="/messages" className="text-violet-400 hover:text-violet-300 text-sm transition">
          Back to messages
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      {/* Chat Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06] mb-4">
        <Link href="/messages" className="p-2 -ml-2 rounded-lg hover:bg-white/[0.05] text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>

        <Link href={`/profile/${username}`} className="flex items-center gap-3 flex-1 group">
          <div className="relative">
            <img
              src={otherUser.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
              alt={username}
              className="w-10 h-10 rounded-full"
            />
            {otherUser.token_mint && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#030303]" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-white group-hover:text-violet-300 transition">
              {otherUser.twitter_name || username}
            </h2>
            <p className="text-xs text-gray-500">@{username}</p>
          </div>
        </Link>

        {otherUser.token_symbol && (
          <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full">
            {otherUser.token_symbol}
          </span>
        )}
      </div>

      {/* Token Requirement Banner */}
      {!canSend && (otherUser.token_mint || currentUser?.token_mint) && (
        <div className="mb-4 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium mb-2">Token required to chat</p>
              <div className="space-y-1 text-xs">
                {otherUser.token_mint && (
                  <p className="text-gray-400">
                    You need <span className="text-violet-400 font-medium">{theirMinTokenAmount} {otherUser.token_symbol}</span>
                    {" "}(you have {myBalanceOfTheirToken?.toLocaleString() || 0})
                  </p>
                )}
                {currentUser?.token_mint && (
                  <p className="text-gray-400">
                    Or they need <span className="text-fuchsia-400 font-medium">{myMinTokenAmount} {currentUser.token_symbol}</span>
                    {" "}(they have {theirBalanceOfMyToken?.toLocaleString() || 0})
                  </p>
                )}
              </div>
            </div>
            {otherUser.token_mint && (
              <Link
                href={`/profile/${username}`}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition shrink-0"
              >
                Buy Tokens
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto rounded-2xl glass-card p-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">Start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-white/[0.05] text-xs text-gray-500">
                    {date}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {msgs.map((message) => {
                    const isMine = message.sender_id === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                            isMine
                              ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-br-md"
                              : "bg-white/[0.08] text-gray-200 rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? "text-white/60" : "text-gray-500"}`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Message Input */}
      <div className="flex gap-3">
        <textarea
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={canSend ? "Type a message..." : "Token required to chat"}
          disabled={!canSend || sending}
          rows={1}
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/40 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: "48px", maxHeight: "120px" }}
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() || !canSend || sending}
          className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
