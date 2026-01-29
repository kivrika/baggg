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
