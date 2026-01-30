"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import dynamic from "next/dynamic";

const PostModal = dynamic(() => import("@/components/PostModal"), { ssr: false });

interface Post {
  id: number;
  user_id: number;
  content: string;
  is_pinned: boolean;
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
  // Repost info
  is_repost?: boolean;
  repost_id?: number;
  reposter_username?: string;
  reposter_name?: string | null;
  reposter_pfp?: string | null;
  repost_created_at?: string;
}

export default function FeedPage() {
  const { authenticated, user } = usePrivy();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [liking, setLiking] = useState<number | null>(null);
  const [reposting, setReposting] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const url = user?.id ? `/api/posts?privyId=${user.id}` : "/api/posts";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error("Failed to fetch posts:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Check if user can post (has a coin)
  const checkCanPost = useCallback(async () => {
    if (!user?.id) {
      setCanPost(false);
      return;
    }
    try {
      const res = await fetch(`/api/users?privyId=${user.id}`);
      const data = await res.json();
      if (data.success && data.user?.token_mint) {
        setCanPost(true);
      } else {
        setCanPost(false);
      }
    } catch (e) {
      setCanPost(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (authenticated && user?.id) {
      checkCanPost();
    }
  }, [authenticated, user?.id, checkCanPost]);

  const handleDelete = async (postId: number) => {
    if (!user?.id || !confirm("Are you sure you want to delete this post?")) return;

    setDeleting(postId);
    try {
      const res = await fetch("/api/posts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          postId,
        }),
      });

      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
      }
    } catch (e) {
      console.error("Failed to delete post:", e);
    } finally {
      setDeleting(null);
    }
  };

  const handleLike = async (postId: number) => {
    if (!user?.id || !authenticated) return;

    setLiking(postId);
    try {
      const res = await fetch("/api/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, postId }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts(posts.map((p) =>
          p.id === postId
            ? { ...p, liked: data.liked, like_count: data.count }
            : p
        ));
      }
    } catch (e) {
      console.error("Failed to like post:", e);
    } finally {
      setLiking(null);
    }
  };

  const handleRepost = async (postId: number) => {
    if (!user?.id || !authenticated) return;

    setReposting(postId);
    try {
      const res = await fetch("/api/posts/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, postId }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts(posts.map((p) =>
          p.id === postId
            ? { ...p, reposted: data.reposted, repost_count: data.count }
            : p
        ));
      }
    } catch (e) {
      console.error("Failed to repost:", e);
    } finally {
      setReposting(null);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() || !user?.id) return;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          content: newPost.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setPosts([data.post, ...posts]);
        setNewPost("");
      } else {
        setError(data.error || "Failed to post");
      }
    } catch (e) {
      setError("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Feed</h1>
        <p className="text-sm text-gray-500 mt-1">
          Updates from coin creators
        </p>
      </div>

      {/* Post Form (only for coin owners) */}
      {authenticated && canPost && (
        <div className="mb-8 p-4 rounded-2xl glass-card border border-white/[0.06]">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={500}
            rows={3}
            className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
            <span className={`text-xs ${newPost.length > 450 ? "text-yellow-400" : "text-gray-600"}`}>
              {newPost.length}/500
            </span>
            <button
              onClick={handlePost}
              disabled={posting || !newPost.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Info for non-coin owners */}
      {authenticated && !canPost && (
        <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
          <p className="text-gray-400 text-sm">
            Launch your coin to post updates
          </p>
        </div>
      )}

      {/* Posts Timeline */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 rounded-3xl glass-card">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Be the first creator to share an update!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.is_repost ? `repost-${post.repost_id}` : `post-${post.id}`}
              className="p-5 rounded-2xl glass-card border border-white/[0.04] hover:border-white/[0.08] transition"
            >
              {/* Repost indicator */}
              {post.is_repost && post.reposter_username && (
                <div className="flex items-center gap-1.5 text-xs text-green-500 mb-3 -mt-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                  <Link href={`/profile/${post.reposter_username}`} className="hover:underline">
                    {post.reposter_name || post.reposter_username} reposted
                  </Link>
                </div>
              )}

              {/* Author */}
              <div className="flex items-start gap-3 mb-3">
                <Link href={`/profile/${post.twitter_username}`}>
                  {post.twitter_pfp ? (
                    <img
                      src={post.twitter_pfp}
                      alt=""
                      className="w-10 h-10 rounded-full hover:ring-2 hover:ring-violet-500/50 transition"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/profile/${post.twitter_username}`}
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
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>@{post.twitter_username}</span>
                    <span>·</span>
                    <span>{formatTime(post.created_at)}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Content - clickable to open modal */}
              <p
                className="text-gray-200 whitespace-pre-wrap break-words cursor-pointer hover:text-gray-100 transition"
                onClick={() => setSelectedPost(post)}
              >
                {post.content}
              </p>

              {/* Actions: Like, Repost, Delete */}
              <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-4">
                {/* Like button */}
                <button
                  onClick={() => handleLike(post.id)}
                  disabled={!authenticated || liking === post.id}
                  className={`flex items-center gap-1.5 text-sm transition ${
                    post.liked
                      ? "text-pink-500"
                      : "text-gray-500 hover:text-pink-500"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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

                {/* Repost button */}
                <button
                  onClick={() => handleRepost(post.id)}
                  disabled={!authenticated || reposting === post.id}
                  className={`flex items-center gap-1.5 text-sm transition ${
                    post.reposted
                      ? "text-green-500"
                      : "text-gray-500 hover:text-green-500"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
                    />
                  </svg>
                  <span>{post.repost_count || 0}</span>
                </button>

                {/* Comment button */}
                <button
                  onClick={() => setSelectedPost(post)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-400 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                    />
                  </svg>
                  <span>{post.comment_count || 0}</span>
                </button>

                {/* Delete button for own posts */}
                {user?.id && user.twitter?.username === post.twitter_username && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="ml-auto text-xs text-red-400/60 hover:text-red-400 transition"
                  >
                    {deleting === post.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center mt-8">
        <button
          onClick={fetchPosts}
          className="px-6 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-gray-400 hover:text-white transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          post={selectedPost}
          privyId={user?.id || null}
          authenticated={authenticated}
          onLike={(postId) => {
            handleLike(postId);
            // Update selectedPost too
            const updated = posts.find(p => p.id === postId);
            if (updated) {
              setSelectedPost({ ...updated, liked: !updated.liked, like_count: updated.liked ? updated.like_count - 1 : updated.like_count + 1 });
            }
          }}
          onRepost={(postId) => {
            handleRepost(postId);
            const updated = posts.find(p => p.id === postId);
            if (updated) {
              setSelectedPost({ ...updated, reposted: !updated.reposted, repost_count: updated.reposted ? updated.repost_count - 1 : updated.repost_count + 1 });
            }
          }}
        />
      )}
    </div>
  );
}
