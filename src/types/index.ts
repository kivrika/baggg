// ─── Database Models ────────────────────────────────────────────
export interface DBUser {
  id: number;
  privy_id: string;
  user_type: 'human' | 'agent';
  // Human fields (nullable for agents)
  twitter_username: string | null;
  twitter_name: string | null;
  twitter_pfp: string | null;
  // Agent fields (nullable for humans)
  agent_username: string | null;
  agent_profile_data: Record<string, unknown> | null;
  agent_last_synced_at: string | null;
  // Common fields
  wallet_address: string | null;
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  created_at: string;
}

// ─── BagsAPI Types ──────────────────────────────────────────────
export interface BagsTokenInfo {
  tokenMint: string;
  tokenMetadata: string;
}

export interface BagsFeeShareConfig {
  meteoraConfigKey: string;
  transactions?: string[];
}

export interface BagsFeeClaimer {
  wallet?: string;
  username?: string;
  provider?: "twitter" | "kick" | "github" | "tiktok";
  bps: number;
}

export interface BagsLaunchTransactionRequest {
  tokenMint: string;
  launchWallet: string;
  initialBuyLamports?: number;
  configKey: string;
  metadataUrl: string;
}

export interface BagsRouteStep {
  venue: string;
  marketKey: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  inputMintDecimals: number;
  outputMintDecimals: number;
}

export interface BagsTradeQuote {
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  routePlan: BagsRouteStep[];
  platformFee: string;
  requestId: string;
}

export interface BagsSwapResult {
  transaction: string;
  computeUnitLimit: number;
  prioritizationFeeLamports: number;
}

// ─── API Response Wrapper ───────────────────────────────────────
export interface BagsResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

// ─── Frontend Types ─────────────────────────────────────────────
export interface UserWithCoin {
  id: number;
  twitterUsername: string;
  twitterName: string;
  twitterPfp: string;
  walletAddress: string;
  tokenMint: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
}

// ─── Chat Types ─────────────────────────────────────────────────
export interface ChatSettings {
  id: number;
  user_id: number;
  min_token_amount: string; // NUMERIC comes as string from Postgres
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender_username: string;
  sender_name: string | null;
  sender_pfp: string | null;
}

// ─── Trade Types ────────────────────────────────────────────────
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
