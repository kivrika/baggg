import { createTokenInfo, createFeeShareConfig, createLaunchTransaction } from "./bags";

export interface PrepareTokenResult {
  tokenMint: string;
  tokenMetadata: string;
  configKey: string;
  configTransactions: string[];
}

export interface FinalizeTokenResult {
  launchTransaction: string;
}

// Step 1: Prepare token - create token info and fee config
export async function prepareToken(params: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  creatorWallet: string;
}): Promise<PrepareTokenResult> {
  // Create token metadata
  console.log("Step 1: Creating token info...");
  const twitterUrl = params.twitter ? `https://x.com/${params.twitter}` : undefined;

  const tokenInfo = await createTokenInfo({
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    twitter: twitterUrl,
  });
  console.log("Step 1 SUCCESS:", tokenInfo.tokenMint);

  // Wait for token to propagate
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Create fee share config
  console.log("Step 2: Creating fee share config...");
  console.log("  payer:", params.creatorWallet);
  console.log("  baseMint:", tokenInfo.tokenMint);

  const feeConfig = await createFeeShareConfig({
    payer: params.creatorWallet,
    baseMint: tokenInfo.tokenMint,
    claimersArray: [params.creatorWallet],
    basisPointsArray: [10000],
  });

  console.log("Step 2 SUCCESS - Full response:", JSON.stringify(feeConfig, null, 2));
  console.log("  All keys in response:", Object.keys(feeConfig));

  // Cast to any to check different possible field names
  const feeConfigAny = feeConfig as unknown as Record<string, unknown>;

  // Try different possible field names for config key
  const configKey = feeConfigAny.meteoraConfigKey
    || feeConfigAny.configKey
    || feeConfigAny.config_key
    || feeConfigAny.key;

  // Get transactions - they come as objects with {transaction, blockhash}
  const rawTransactions = feeConfigAny.transactions || [];

  console.log("  Found configKey:", configKey);
  console.log("  Found raw transactions count:", Array.isArray(rawTransactions) ? rawTransactions.length : 0);

  if (!configKey) {
    console.error("WARNING: No config key found in response!");
    console.error("Full feeConfig object:", JSON.stringify(feeConfig, null, 2));
    throw new Error("Fee share config did not return a config key. Response: " + JSON.stringify(feeConfig));
  }

  // Extract transaction strings from objects
  let configTransactions: string[] = [];
  if (Array.isArray(rawTransactions)) {
    configTransactions = rawTransactions.map((tx: unknown) => {
      if (typeof tx === 'string') return tx;
      if (tx && typeof tx === 'object' && 'transaction' in tx) {
        return (tx as { transaction: string }).transaction;
      }
      return null;
    }).filter((tx): tx is string => tx !== null);
  }

  console.log("  Extracted transaction strings:", configTransactions.length);

  return {
    tokenMint: tokenInfo.tokenMint,
    tokenMetadata: tokenInfo.tokenMetadata,
    configKey: configKey as string,
    configTransactions,
  };
}

// Step 2: Finalize token - create launch transaction (call after config tx confirmed)
export async function finalizeToken(params: {
  tokenMint: string;
  tokenMetadata: string;
  configKey: string;
  creatorWallet: string;
}): Promise<FinalizeTokenResult> {
  console.log("Step 3: Creating launch transaction...");
  console.log("  tokenMint:", params.tokenMint);
  console.log("  configKey:", params.configKey);
  console.log("  metadataUrl:", params.tokenMetadata);
  console.log("  wallet:", params.creatorWallet);

  if (!params.configKey || params.configKey === "undefined") {
    throw new Error("Config key is missing or invalid");
  }

  const launchTx = await createLaunchTransaction({
    tokenMint: params.tokenMint,
    launchWallet: params.creatorWallet,
    initialBuyLamports: 0,
    configKey: params.configKey,
    metadataUrl: params.tokenMetadata,
  });
  console.log("Step 3 SUCCESS - launchTx type:", typeof launchTx);
  console.log("  launchTx preview:", String(launchTx).substring(0, 100));

  // Handle both cases: API returns string directly OR { transaction: string }
  let transactionString: string;
  if (typeof launchTx === 'string') {
    transactionString = launchTx;
    console.log("  launchTx is direct string, length:", transactionString.length);
  } else if (launchTx && typeof launchTx === 'object' && 'transaction' in launchTx) {
    transactionString = (launchTx as { transaction: string }).transaction;
    console.log("  Extracted from object, length:", transactionString.length);
  } else {
    console.error("ERROR: Unexpected launchTx format!");
    throw new Error("BagsAPI returned unexpected format: " + JSON.stringify(launchTx).substring(0, 200));
  }

  return {
    launchTransaction: transactionString,
  };
}
