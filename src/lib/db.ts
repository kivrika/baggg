import { neon } from "@neondatabase/serverless";
import { DBUser, ChatSettings, Message, MessageWithSender } from "@/types";

const sql = neon(process.env.DATABASE_URL!);

let initialized = false;

async function initDb() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      privy_id TEXT UNIQUE NOT NULL,
      twitter_username TEXT UNIQUE NOT NULL,
      twitter_name TEXT,
      twitter_pfp TEXT,
      wallet_address TEXT,
      token_mint TEXT,
      token_name TEXT,
      token_symbol TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Chat settings table
  await sql`
    CREATE TABLE IF NOT EXISTS chat_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      min_token_amount NUMERIC(38, 18) NOT NULL DEFAULT 0,
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `;

  // Messages table
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create indexes for messages
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC)`;

  initialized = true;
}

export async function getUserByPrivyId(privyId: string): Promise<DBUser | undefined> {
  await initDb();
  const rows = await sql`SELECT * FROM users WHERE privy_id = ${privyId}`;
  return rows[0] as DBUser | undefined;
}

export async function getUserByTwitter(username: string): Promise<DBUser | undefined> {
  await initDb();
  const rows = await sql`SELECT * FROM users WHERE twitter_username = ${username}`;
  return rows[0] as DBUser | undefined;
}

export async function getUserByTokenMint(mint: string): Promise<DBUser | undefined> {
  await initDb();
  const rows = await sql`SELECT * FROM users WHERE token_mint = ${mint}`;
  return rows[0] as DBUser | undefined;
}

export async function createUser(data: {
  privyId: string;
  twitterUsername: string;
  twitterName?: string;
  twitterPfp?: string;
  walletAddress?: string;
}): Promise<DBUser> {
  await initDb();
  await sql`
    INSERT INTO users (privy_id, twitter_username, twitter_name, twitter_pfp, wallet_address)
    VALUES (${data.privyId}, ${data.twitterUsername}, ${data.twitterName || null}, ${data.twitterPfp || null}, ${data.walletAddress || null})
    ON CONFLICT (privy_id) DO UPDATE SET
      twitter_username = ${data.twitterUsername},
      twitter_name = ${data.twitterName || null},
      twitter_pfp = ${data.twitterPfp || null},
      wallet_address = COALESCE(users.wallet_address, ${data.walletAddress || null})
  `;
  return (await getUserByPrivyId(data.privyId))!;
}

export async function updateUserToken(privyId: string, tokenMint: string, tokenName: string, tokenSymbol: string) {
  await initDb();
  await sql`
    UPDATE users SET token_mint = ${tokenMint}, token_name = ${tokenName}, token_symbol = ${tokenSymbol}
    WHERE privy_id = ${privyId}
  `;
}

export async function updateUserWallet(privyId: string, walletAddress: string) {
  await initDb();
  await sql`UPDATE users SET wallet_address = ${walletAddress} WHERE privy_id = ${privyId}`;
}

export async function getAllUsersWithCoins(): Promise<DBUser[]> {
  await initDb();
  const rows = await sql`SELECT * FROM users WHERE token_mint IS NOT NULL ORDER BY created_at DESC`;
  return rows as DBUser[];
}

export async function getAllUsers(): Promise<DBUser[]> {
  await initDb();
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return rows as DBUser[];
}

// ─── Chat Settings Functions ────────────────────────────────────

export async function getChatSettings(userId: number): Promise<ChatSettings | undefined> {
  await initDb();
  const rows = await sql`SELECT * FROM chat_settings WHERE user_id = ${userId}`;
  return rows[0] as ChatSettings | undefined;
}

export async function getChatSettingsByUsername(username: string): Promise<ChatSettings | undefined> {
  await initDb();
  const rows = await sql`
    SELECT cs.* FROM chat_settings cs
    JOIN users u ON cs.user_id = u.id
    WHERE u.twitter_username = ${username}
  `;
  return rows[0] as ChatSettings | undefined;
}

export async function upsertChatSettings(userId: number, minTokenAmount: number, isEnabled: boolean): Promise<void> {
  await initDb();
  await sql`
    INSERT INTO chat_settings (user_id, min_token_amount, is_enabled, updated_at)
    VALUES (${userId}, ${minTokenAmount}, ${isEnabled}, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      min_token_amount = ${minTokenAmount},
      is_enabled = ${isEnabled},
      updated_at = CURRENT_TIMESTAMP
  `;
}

// ─── Message Functions ──────────────────────────────────────────

export async function createMessage(senderId: number, recipientId: number, content: string): Promise<Message> {
  await initDb();
  const rows = await sql`
    INSERT INTO messages (sender_id, recipient_id, content)
    VALUES (${senderId}, ${recipientId}, ${content})
    RETURNING *
  `;
  return rows[0] as Message;
}

export async function getInboxMessages(userId: number, limit = 50, offset = 0): Promise<MessageWithSender[]> {
  await initDb();
  const rows = await sql`
    SELECT m.*,
           u.twitter_username as sender_username,
           u.twitter_name as sender_name,
           u.twitter_pfp as sender_pfp
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.recipient_id = ${userId}
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as MessageWithSender[];
}

export async function getConversation(userId: number, otherUserId: number, limit = 50): Promise<Message[]> {
  await initDb();
  const rows = await sql`
    SELECT * FROM messages
    WHERE (sender_id = ${userId} AND recipient_id = ${otherUserId})
       OR (sender_id = ${otherUserId} AND recipient_id = ${userId})
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows as Message[];
}

export async function markMessagesAsRead(recipientId: number, senderId: number): Promise<void> {
  await initDb();
  await sql`
    UPDATE messages SET is_read = true
    WHERE recipient_id = ${recipientId} AND sender_id = ${senderId} AND is_read = false
  `;
}

export async function getUnreadCount(userId: number): Promise<number> {
  await initDb();
  const rows = await sql`SELECT COUNT(*) as count FROM messages WHERE recipient_id = ${userId} AND is_read = false`;
  return parseInt(rows[0].count as string) || 0;
}

export async function hasMessaged(senderId: number, recipientId: number): Promise<boolean> {
  await initDb();
  const rows = await sql`SELECT 1 FROM messages WHERE sender_id = ${senderId} AND recipient_id = ${recipientId} LIMIT 1`;
  return rows.length > 0;
}

// ─── Trade Functions ─────────────────────────────────────────────

export interface Trade {
  id: number;
  user_id: number;
  token_mint: string;
  trade_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  tx_signature: string;
  created_at: string;
}

export interface TradeWithUser extends Trade {
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
  token_symbol: string | null;
  token_owner_username: string | null;
}

export async function initTradesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_mint TEXT NOT NULL,
      trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
      sol_amount NUMERIC(20, 9) NOT NULL,
      token_amount NUMERIC(38, 18) NOT NULL,
      tx_signature TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_mint)`;
}

export async function createTrade(data: {
  userId: number;
  tokenMint: string;
  tradeType: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  txSignature: string;
}): Promise<Trade> {
  await initDb();
  await initTradesTable();

  const rows = await sql`
    INSERT INTO trades (user_id, token_mint, trade_type, sol_amount, token_amount, tx_signature)
    VALUES (${data.userId}, ${data.tokenMint}, ${data.tradeType}, ${data.solAmount}, ${data.tokenAmount}, ${data.txSignature})
    RETURNING *
  `;
  return rows[0] as Trade;
}

export async function getRecentTrades(limit = 50, offset = 0): Promise<TradeWithUser[]> {
  await initDb();
  await initTradesTable();

  const rows = await sql`
    SELECT t.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           owner.token_symbol,
           owner.twitter_username as token_owner_username
    FROM trades t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users owner ON t.token_mint = owner.token_mint
    ORDER BY t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as TradeWithUser[];
}

export async function getUserTrades(userId: number, limit = 50): Promise<TradeWithUser[]> {
  await initDb();
  await initTradesTable();

  const rows = await sql`
    SELECT t.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           owner.token_symbol,
           owner.twitter_username as token_owner_username
    FROM trades t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users owner ON t.token_mint = owner.token_mint
    WHERE t.user_id = ${userId}
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows as TradeWithUser[];
}

export async function getTokenTrades(tokenMint: string, limit = 50): Promise<TradeWithUser[]> {
  await initDb();
  await initTradesTable();

  const rows = await sql`
    SELECT t.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           owner.token_symbol,
           owner.twitter_username as token_owner_username
    FROM trades t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users owner ON t.token_mint = owner.token_mint
    WHERE t.token_mint = ${tokenMint}
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows as TradeWithUser[];
}

// ─── Post Functions ─────────────────────────────────────────────

export interface Post {
  id: number;
  user_id: number;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface PostWithUser extends Post {
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
  token_symbol: string | null;
  is_pinned: boolean;
  // Repost info
  is_repost?: boolean;
  repost_id?: number;
  reposter_username?: string;
  reposter_name?: string | null;
  reposter_pfp?: string | null;
  repost_created_at?: string;
}

export async function initPostsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_pinned BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`;

  // Add is_pinned column if it doesn't exist
  try {
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false`;
  } catch (e) {
    // Column might already exist
  }
}

export async function createPost(userId: number, content: string): Promise<Post> {
  await initDb();
  await initPostsTable();

  const rows = await sql`
    INSERT INTO posts (user_id, content)
    VALUES (${userId}, ${content})
    RETURNING *
  `;
  return rows[0] as Post;
}

export async function getAllPosts(limit = 50, offset = 0): Promise<PostWithUser[]> {
  await initDb();
  await initPostsTable();
  await initLikesRepostsTable();

  // Get original posts
  const originalPosts = await sql`
    SELECT p.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           u.token_symbol,
           false as is_repost,
           NULL::integer as repost_id,
           NULL as reposter_username,
           NULL as reposter_name,
           NULL as reposter_pfp,
           p.created_at as sort_date
    FROM posts p
    JOIN users u ON p.user_id = u.id
  `;

  // Get reposts with original post data
  const reposts = await sql`
    SELECT p.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           u.token_symbol,
           true as is_repost,
           r.id as repost_id,
           reposter.twitter_username as reposter_username,
           reposter.twitter_name as reposter_name,
           reposter.twitter_pfp as reposter_pfp,
           r.created_at as sort_date
    FROM post_reposts r
    JOIN posts p ON r.post_id = p.id
    JOIN users u ON p.user_id = u.id
    JOIN users reposter ON r.user_id = reposter.id
  `;

  // Combine and sort by date
  const allPosts = [...originalPosts, ...reposts]
    .sort((a, b) => new Date(b.sort_date as string).getTime() - new Date(a.sort_date as string).getTime())
    .slice(offset, offset + limit);

  return allPosts.map(post => ({
    ...post,
    repost_created_at: post.is_repost ? post.sort_date : undefined,
  })) as PostWithUser[];
}

export async function getUserPosts(userId: number, limit = 50): Promise<PostWithUser[]> {
  await initDb();
  await initPostsTable();

  const rows = await sql`
    SELECT p.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           u.token_symbol
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;
  return rows as PostWithUser[];
}

export async function deletePost(postId: number, userId: number): Promise<boolean> {
  await initDb();
  await initPostsTable();

  const result = await sql`
    DELETE FROM posts WHERE id = ${postId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function getLastPostTime(userId: number): Promise<Date | null> {
  await initDb();
  await initPostsTable();

  const rows = await sql`
    SELECT created_at FROM posts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return new Date(rows[0].created_at as string);
}

export async function getUserPostsForProfile(userId: number, limit = 3): Promise<PostWithUser[]> {
  await initDb();
  await initPostsTable();

  // Get pinned post first, then recent posts
  const rows = await sql`
    SELECT p.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp,
           u.token_symbol
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ${userId}
    ORDER BY p.is_pinned DESC, p.created_at DESC
    LIMIT ${limit}
  `;
  return rows as PostWithUser[];
}

export async function pinPost(postId: number, userId: number): Promise<boolean> {
  await initDb();
  await initPostsTable();

  // First, unpin all user's posts
  await sql`UPDATE posts SET is_pinned = false WHERE user_id = ${userId}`;

  // Then pin the selected post
  const result = await sql`
    UPDATE posts SET is_pinned = true
    WHERE id = ${postId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function unpinPost(postId: number, userId: number): Promise<boolean> {
  await initDb();
  await initPostsTable();

  const result = await sql`
    UPDATE posts SET is_pinned = false
    WHERE id = ${postId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

// ─── Like & Repost Functions ─────────────────────────────────────

export async function initLikesRepostsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS post_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS post_reposts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_reposts_post ON post_reposts(post_id)`;
}

export async function toggleLike(userId: number, postId: number): Promise<{ liked: boolean; count: number }> {
  await initDb();
  await initLikesRepostsTable();

  // Check if already liked
  const existing = await sql`SELECT id FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId}`;

  if (existing.length > 0) {
    // Unlike
    await sql`DELETE FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId}`;
  } else {
    // Like
    await sql`INSERT INTO post_likes (user_id, post_id) VALUES (${userId}, ${postId})`;
  }

  // Get new count
  const countResult = await sql`SELECT COUNT(*) as count FROM post_likes WHERE post_id = ${postId}`;
  const count = parseInt(countResult[0].count as string) || 0;

  return { liked: existing.length === 0, count };
}

export async function toggleRepost(userId: number, postId: number): Promise<{ reposted: boolean; count: number }> {
  await initDb();
  await initLikesRepostsTable();

  // Check if already reposted
  const existing = await sql`SELECT id FROM post_reposts WHERE user_id = ${userId} AND post_id = ${postId}`;

  if (existing.length > 0) {
    // Un-repost
    await sql`DELETE FROM post_reposts WHERE user_id = ${userId} AND post_id = ${postId}`;
  } else {
    // Repost
    await sql`INSERT INTO post_reposts (user_id, post_id) VALUES (${userId}, ${postId})`;
  }

  // Get new count
  const countResult = await sql`SELECT COUNT(*) as count FROM post_reposts WHERE post_id = ${postId}`;
  const count = parseInt(countResult[0].count as string) || 0;

  return { reposted: existing.length === 0, count };
}

export async function getPostStats(postId: number, userId?: number): Promise<{
  likeCount: number;
  repostCount: number;
  commentCount: number;
  liked: boolean;
  reposted: boolean;
}> {
  await initDb();
  await initLikesRepostsTable();
  await initCommentsTable();

  const likeCountResult = await sql`SELECT COUNT(*) as count FROM post_likes WHERE post_id = ${postId}`;
  const repostCountResult = await sql`SELECT COUNT(*) as count FROM post_reposts WHERE post_id = ${postId}`;
  const commentCountResult = await sql`SELECT COUNT(*) as count FROM post_comments WHERE post_id = ${postId}`;

  let liked = false;
  let reposted = false;

  if (userId) {
    const likedResult = await sql`SELECT 1 FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId}`;
    const repostedResult = await sql`SELECT 1 FROM post_reposts WHERE user_id = ${userId} AND post_id = ${postId}`;
    liked = likedResult.length > 0;
    reposted = repostedResult.length > 0;
  }

  return {
    likeCount: parseInt(likeCountResult[0].count as string) || 0,
    repostCount: parseInt(repostCountResult[0].count as string) || 0,
    commentCount: parseInt(commentCountResult[0].count as string) || 0,
    liked,
    reposted,
  };
}

export async function getPostsWithStats(posts: PostWithUser[], userId?: number): Promise<(PostWithUser & {
  like_count: number;
  repost_count: number;
  comment_count: number;
  liked: boolean;
  reposted: boolean;
})[]> {
  await initDb();
  await initLikesRepostsTable();
  await initCommentsTable();

  const result = await Promise.all(
    posts.map(async (post) => {
      const stats = await getPostStats(post.id, userId);
      return {
        ...post,
        like_count: stats.likeCount,
        repost_count: stats.repostCount,
        comment_count: stats.commentCount,
        liked: stats.liked,
        reposted: stats.reposted,
      };
    })
  );

  return result;
}

// ─── Comment Functions ─────────────────────────────────────────

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface CommentWithUser extends Comment {
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
}

export async function initCommentsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at ASC)`;
}

export async function createComment(postId: number, userId: number, content: string): Promise<CommentWithUser> {
  await initDb();
  await initCommentsTable();

  const rows = await sql`
    INSERT INTO post_comments (post_id, user_id, content)
    VALUES (${postId}, ${userId}, ${content})
    RETURNING *
  `;

  const comment = rows[0] as Comment;

  // Get user info
  const userRows = await sql`SELECT twitter_username, twitter_name, twitter_pfp FROM users WHERE id = ${userId}`;
  const user = userRows[0];

  return {
    ...comment,
    twitter_username: user.twitter_username as string,
    twitter_name: user.twitter_name as string | null,
    twitter_pfp: user.twitter_pfp as string | null,
  };
}

export async function getPostComments(postId: number): Promise<CommentWithUser[]> {
  await initDb();
  await initCommentsTable();

  const rows = await sql`
    SELECT c.*,
           u.twitter_username,
           u.twitter_name,
           u.twitter_pfp
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ${postId}
    ORDER BY c.created_at ASC
  `;

  return rows as CommentWithUser[];
}

export async function getCommentCount(postId: number): Promise<number> {
  await initDb();
  await initCommentsTable();

  const rows = await sql`SELECT COUNT(*) as count FROM post_comments WHERE post_id = ${postId}`;
  return parseInt(rows[0].count as string) || 0;
}

export async function deleteComment(commentId: number, userId: number): Promise<boolean> {
  await initDb();
  await initCommentsTable();

  const result = await sql`
    DELETE FROM post_comments WHERE id = ${commentId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}
