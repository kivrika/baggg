"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Post {
  id: number;
  content: string;
  created_at: string;
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
  token_symbol: string | null;
  like_count: number;
  repost_count: number;
  comment_count: number;
  liked: boolean;
  reposted: boolean;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
}

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  privyId: string | null;
  authenticated: boolean;
  onLike: (postId: number) => void;
  onRepost: (postId: number) => void;
}

export default function PostModal({
  isOpen,
  onClose,
  post,
  privyId,
  authenticated,
  onLike,
  onRepost,
}: PostModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (isOpen && post.id) {
      fetchComments();
    }
  }, [isOpen, post.id]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/comments?postId=${post.id}`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (e) {
      console.error("Failed to fetch comments:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !privyId) return;

    setPosting(true);
    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId,
          postId: post.id,
          content: newComment.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setComments([...comments, data.comment]);
        setNewComment("");
      }
    } catch (e) {
      console.error("Failed to post comment:", e);
    } finally {
      setPosting(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-[#0a0a0f] border border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">Post</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/[0.05] transition"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Original Post */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-start gap-3 mb-3">
              <Link href={`/profile/${post.twitter_username}`} onClick={onClose}>
                {post.twitter_pfp ? (
                  <img
                    src={post.twitter_pfp}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${post.twitter_username}`}
                    onClick={onClose}
                    className="font-semibold text-white hover:text-violet-400 transition"
                  >
                    {post.twitter_name || post.twitter_username}
                  </Link>
                  {post.token_symbol && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium">
                      ${post.token_symbol}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">@{post.twitter_username}</span>
              </div>
            </div>

            <p className="text-gray-200 whitespace-pre-wrap break-words mb-3">
              {post.content}
            </p>

            <span className="text-xs text-gray-600">{formatTimeAgo(post.created_at)}</span>

            {/* Actions */}
            <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-6">
              <button
                onClick={() => onLike(post.id)}
                disabled={!authenticated}
                className={`flex items-center gap-1.5 text-sm transition ${
                  post.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill={post.liked ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={post.liked ? 0 : 2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                <span>{post.like_count || 0}</span>
              </button>

              <button
                onClick={() => onRepost(post.id)}
                disabled={!authenticated}
                className={`flex items-center gap-1.5 text-sm transition ${
                  post.reposted ? "text-green-500" : "text-gray-500 hover:text-green-500"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                <span>{post.repost_count || 0}</span>
              </button>

              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                <span>{comments.length}</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Comments</h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Link href={`/profile/${comment.twitter_username}`} onClick={onClose}>
                      {comment.twitter_pfp ? (
                        <img
                          src={comment.twitter_pfp}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/profile/${comment.twitter_username}`}
                          onClick={onClose}
                          className="font-medium text-sm text-white hover:text-violet-400 transition"
                        >
                          {comment.twitter_name || comment.twitter_username}
                        </Link>
                        <span className="text-xs text-gray-600">
                          {formatTimeAgo(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comment Input */}
        {authenticated && (
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                maxLength={280}
                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              <button
                onClick={handleSubmitComment}
                disabled={posting || !newComment.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
