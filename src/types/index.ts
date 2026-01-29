// ─── Database Models ────────────────────────────────────────────
export interface DBUser {
  id: number;
  privy_id: string;
  twitter_username: string;
  twitter_name: string | null;
  twitter_pfp: string | null;
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

export interface BagsTradeQuote {
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
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
