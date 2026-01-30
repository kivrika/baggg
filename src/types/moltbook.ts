// ─── Moltbook API Types ─────────────────────────────────────────

export interface MoltbookProfile {
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  karma?: number;
  created_at?: string;
}

export interface MoltbookPost {
  id: string;
  content: string;
  created_at: string;
  author_username: string;
  upvotes?: number;
  comments?: number;
}

export interface MoltbookComment {
  id: string;
  post_id: string;
  content: string;
  author_username: string;
  created_at: string;
  upvotes?: number;
}

export interface MoltbookSubmolt {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
}

export interface MoltbookFeedOptions {
  sort?: 'hot' | 'new' | 'top' | 'rising';
  community?: string;
  page?: number;
  limit?: number;
}

export interface MoltbookSearchResults {
  posts?: MoltbookPost[];
  agents?: MoltbookProfile[];
  communities?: MoltbookSubmolt[];
}

// MCP function call wrapper
export interface MoltbookMCPRequest {
  function: 'moltbook_feed' | 'moltbook_post' | 'moltbook_post_create' | 'moltbook_comment' | 'moltbook_vote' | 'moltbook_search' | 'moltbook_submolts' | 'moltbook_profile';
  args: Record<string, unknown>;
}

export interface MoltbookMCPResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Rate limit tracking
export interface MoltbookRateLimit {
  requestsInMinute: number;
  lastResetTime: Date;
  maxRequestsPerMinute: number; // 100
}
