import {
  BagsTokenInfo,
  BagsFeeShareConfig,
  BagsFeeClaimer,
  BagsTradeQuote,
  BagsSwapResult,
} from "@/types";

const BASE_URL = "https://public-api-v2.bags.fm/api/v1";

function getApiKey(): string {
  const key = process.env.BAGS_API_KEY?.trim();
  if (!key) throw new Error("BAGS_API_KEY is not set");
  return key;
}

async function bagsRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
): Promise<T> {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  console.log(`BagsAPI ${method} ${path} - FULL RESPONSE:`, JSON.stringify(data, null, 2));
  if (!data.success || !data.response) {
    console.error("BagsAPI error response:", JSON.stringify(data, null, 2));
    throw new Error(data.error || data.message || `BagsAPI error: ${res.status} - ${JSON.stringify(data)}`);
  }
  return data.response as T;
}

// ─── Token Launch ───────────────────────────────────────────────

export async function createTokenInfo(params: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  website?: string;
}): Promise<BagsTokenInfo> {
  return bagsRequest<BagsTokenInfo>("POST", "/token-launch/create-token-info", {
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    twitter: params.twitter,
    website: params.website,
  });
}

export async function createFeeShareConfig(params: {
  payer: string;
  baseMint: string;
  claimersArray: string[];
  basisPointsArray: number[];
}): Promise<BagsFeeShareConfig> {
  const result = await bagsRequest<BagsFeeShareConfig>("POST", "/fee-share/config", {
    payer: params.payer,
    baseMint: params.baseMint,
    claimersArray: params.claimersArray,
    basisPointsArray: params.basisPointsArray,
  });
  console.log("Fee share config RAW response:", JSON.stringify(result, null, 2));
  return result;
}

export async function createLaunchTransaction(params: {
  tokenMint: string;
  launchWallet: string;
  initialBuyLamports?: number;
  configKey: string;
  metadataUrl: string;
}): Promise<string | { transaction: string }> {
  return bagsRequest<string | { transaction: string }>(
    "POST",
    "/token-launch/create-launch-transaction",
    {
      tokenMint: params.tokenMint,
      wallet: params.launchWallet,
      initialBuyLamports: params.initialBuyLamports || 0,
      configKey: params.configKey,
      ipfs: params.metadataUrl,
    }
  );
}

// ─── Trading ────────────────────────────────────────────────────

export async function getTradeQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageMode?: "auto" | "manual";
  slippageBps?: number;
}): Promise<BagsTradeQuote> {
  const queryParams: Record<string, string> = {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageMode: params.slippageMode || "auto",
  };
  if (params.slippageBps) {
    queryParams.slippageBps = String(params.slippageBps);
  }
  return bagsRequest<BagsTradeQuote>("GET", "/trade/quote", undefined, queryParams);
}

export async function createSwapTransaction(params: {
  quoteResponse: BagsTradeQuote;
  userPublicKey: string;
}): Promise<BagsSwapResult> {
  return bagsRequest<BagsSwapResult>("POST", "/trade/swap", {
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,
  });
}

// ─── Token Info ─────────────────────────────────────────────────

export async function getTokenCreators(tokenMint: string) {
  return bagsRequest<unknown[]>("GET", "/token-launch/creator/v3", undefined, {
    tokenMint,
  });
}

export async function getTokenLifetimeFees(tokenMint: string) {
  return bagsRequest<{ totalFees: string }>(
    "GET",
    "/token-launch/lifetime-fees",
    undefined,
    { tokenMint }
  );
}

// ─── Fee Claiming ───────────────────────────────────────────────

// Raw API response format
export interface ClaimablePositionRaw {
  programId: string;
  isCustomFeeVault: boolean;
  user: string;
  baseMint: string;  // This is the tokenMint
  quoteMint: string;
  isMigrated: boolean;
  claimerIndex: number;
  userBps: number;
  virtualPool: string;
  virtualPoolClaimableLamportsUserShare: number;
  totalClaimableLamportsUserShare: number;
  // DAMM v2 fields (optional)
  dammV2Position?: string;
  dammV2Pool?: string;
  dammV2PositionNftAccount?: string;
  dammV2ClaimableLamportsUserShare?: number;
}

// Normalized format for our app
export interface ClaimablePosition {
  tokenMint: string;
  claimableLamports: number;
  virtualPoolAddress: string;
  isCustomFeeVault: boolean;
  programId: string;
  baseMint: string;
  quoteMint: string;
  dammV2Position?: string;
  dammV2Pool?: string;
  dammV2PositionNftAccount?: string;
}

export async function getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
  const rawPositions = await bagsRequest<ClaimablePositionRaw[]>(
    "GET",
    "/token-launch/claimable-positions",
    undefined,
    { wallet }
  );

  // Normalize the response
  return rawPositions.map(p => ({
    tokenMint: p.baseMint,
    claimableLamports: p.totalClaimableLamportsUserShare || p.virtualPoolClaimableLamportsUserShare || 0,
    virtualPoolAddress: p.virtualPool,
    isCustomFeeVault: p.isCustomFeeVault,
    programId: p.programId,
    baseMint: p.baseMint,
    quoteMint: p.quoteMint,
    dammV2Position: p.dammV2Position,
    dammV2Pool: p.dammV2Pool,
    dammV2PositionNftAccount: p.dammV2PositionNftAccount,
  }));
}

interface ClaimTxResponse {
  tx: string;
  blockhash: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
}

export async function createClaimTransaction(params: {
  tokenMint: string;
  wallet: string;
  virtualPoolAddress?: string;
  isCustomFeeVault?: boolean;
  programId?: string;
  baseMint?: string;
  quoteMint?: string;
  dammV2Position?: string;
  dammV2Pool?: string;
  dammV2PositionNftAccount?: string;
}): Promise<{ transactions: string[] }> {
  const response = await bagsRequest<ClaimTxResponse[]>("POST", "/token-launch/claim-txs/v2", {
    feeClaimer: params.wallet,
    tokenMint: params.tokenMint,
    virtualPoolAddress: params.virtualPoolAddress,
    isCustomFeeVault: params.isCustomFeeVault,
    feeShareProgramId: params.programId,
    tokenAMint: params.baseMint,
    tokenBMint: params.quoteMint,
    dammV2Position: params.dammV2Position,
    dammV2Pool: params.dammV2Pool,
    dammV2PositionNftAccount: params.dammV2PositionNftAccount,
    claimVirtualPoolFees: !!params.virtualPoolAddress,
    claimDammV2Fees: !!params.dammV2Position,
  });

  // Extract transaction strings from response array
  const transactions = response.map(r => r.tx);
  return { transactions };
}

// ─── Claim Stats ────────────────────────────────────────────────

interface ClaimStatsResponse {
  wallet: string;
  tokenMint: string;
  totalClaimed: string;
}

export async function getClaimStats(tokenMint: string): Promise<ClaimStatsResponse[]> {
  return bagsRequest<ClaimStatsResponse[]>(
    "GET",
    "/token-launch/claim-stats",
    undefined,
    { tokenMint }
  );
}

// SOL mint address (native wrapped SOL)
export const SOL_MINT = "So11111111111111111111111111111111111111112";

// ─── Agent Authentication & Management ─────────────────────────

const AGENT_BASE_URL = "https://public-api-v2.bags.fm/api/v1/agent";

async function agentRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const url = `${AGENT_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  console.log(`BagsAgentAPI ${method} ${path} - Response:`, JSON.stringify(data, null, 2));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Agent API error: ${res.status}`);
  }

  return data as T;
}

// Initialize agent authentication session
export async function initAgentAuth(agentUsername: string) {
  return agentRequest<{
    challenge: string;
    expiresAt: string;
  }>("POST", "/auth/init", {
    agentUsername,
  });
}

// Complete agent login (after posting verification)
export async function completeAgentLogin(agentUsername: string) {
  return agentRequest<{
    token: string;
    expiresAt: string;
  }>("POST", "/auth/login", {
    agentUsername,
  });
}

// Create API key for agent
export async function createAgentApiKey(jwtToken: string, keyName: string) {
  return agentRequest<{
    apiKey: {
      key: string;
      name: string;
      createdAt: string;
    };
  }>("POST", "/dev/keys/create", {
    token: jwtToken,
    name: keyName,
  });
}

// List agent wallets
export async function listAgentWallets(jwtToken: string) {
  return agentRequest<{
    wallets: Array<{
      address: string;
      isPrimary: boolean;
    }>;
  }>("POST", "/wallet/list", {
    token: jwtToken,
  });
}

// Export agent wallet private key
export async function exportAgentWallet(jwtToken: string, walletAddress: string) {
  return agentRequest<{
    privateKey: string;
    address: string;
  }>("POST", "/wallet/export", {
    token: jwtToken,
    wallet: walletAddress,
  });
}

// Resolve username to wallet address via identity provider
export async function resolveWalletFromUsername(
  provider: "moltbook" | "twitter" | "github",
  username: string
): Promise<{ wallet: string }> {
  return bagsRequest<{ wallet: string }>(
    "GET",
    "/token-launch/fee-share/wallet/v2",
    undefined,
    { provider, username }
  );
}
