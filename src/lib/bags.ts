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
  return bagsRequest<BagsFeeShareConfig>("POST", "/fee-share/config", {
    payer: params.payer,
    baseMint: params.baseMint,
    claimersArray: params.claimersArray,
    basisPointsArray: params.basisPointsArray,
  });
}

export async function createLaunchTransaction(params: {
  tokenMint: string;
  launchWallet: string;
  initialBuyLamports?: number;
  configKey: string;
  metadataUrl: string;
}): Promise<{ transaction: string }> {
  return bagsRequest<{ transaction: string }>(
    "POST",
    "/token-launch/create-launch-transaction",
    {
      tokenMint: params.tokenMint,
      launchWallet: params.launchWallet,
      initialBuyLamports: params.initialBuyLamports || 0,
      configKey: params.configKey,
      metadataUrl: params.metadataUrl,
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

// SOL mint address (native wrapped SOL)
export const SOL_MINT = "So11111111111111111111111111111111111111112";
