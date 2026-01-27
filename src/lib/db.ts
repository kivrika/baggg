import Database from "better-sqlite3";
import path from "path";
import { DBUser } from "@/types";

const DB_PATH = path.join(process.cwd(), "data", "friendtech.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        privy_id TEXT UNIQUE NOT NULL,
        twitter_username TEXT UNIQUE NOT NULL,
        twitter_name TEXT,
        twitter_pfp TEXT,
        wallet_address TEXT,
        token_mint TEXT,
        token_name TEXT,
        token_symbol TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  return _db;
}

export function getUserByPrivyId(privyId: string): DBUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE privy_id = ?").get(privyId) as DBUser | undefined;
}

export function getUserByTwitter(username: string): DBUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE twitter_username = ?").get(username) as DBUser | undefined;
}

export function getUserByTokenMint(mint: string): DBUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE token_mint = ?").get(mint) as DBUser | undefined;
}

export function createUser(data: {
  privyId: string;
  twitterUsername: string;
  twitterName?: string;
  twitterPfp?: string;
  walletAddress?: string;
}): DBUser {
  const stmt = getDb().prepare(`
    INSERT INTO users (privy_id, twitter_username, twitter_name, twitter_pfp, wallet_address)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(data.privyId, data.twitterUsername, data.twitterName || null, data.twitterPfp || null, data.walletAddress || null);
  return getUserByPrivyId(data.privyId)!;
}

export function updateUserToken(privyId: string, tokenMint: string, tokenName: string, tokenSymbol: string) {
  getDb().prepare(`
    UPDATE users SET token_mint = ?, token_name = ?, token_symbol = ? WHERE privy_id = ?
  `).run(tokenMint, tokenName, tokenSymbol, privyId);
}

export function updateUserWallet(privyId: string, walletAddress: string) {
  getDb().prepare("UPDATE users SET wallet_address = ? WHERE privy_id = ?").run(walletAddress, privyId);
}

export function getAllUsersWithCoins(): DBUser[] {
  return getDb().prepare("SELECT * FROM users WHERE token_mint IS NOT NULL ORDER BY created_at DESC").all() as DBUser[];
}

export function getAllUsers(): DBUser[] {
  return getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as DBUser[];
}
