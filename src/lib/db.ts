import { neon } from "@neondatabase/serverless";
import { DBUser } from "@/types";

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

export async function clearUserToken(privyId: string) {
  await initDb();
  await sql`UPDATE users SET token_mint = NULL, token_name = NULL, token_symbol = NULL WHERE privy_id = ${privyId}`;
}

export async function clearUserTokenByWallet(walletAddress: string) {
  await initDb();
  await sql`UPDATE users SET token_mint = NULL, token_name = NULL, token_symbol = NULL WHERE wallet_address = ${walletAddress}`;
}
