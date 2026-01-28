import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function getSDK() {
  const apiKey = process.env.BAGS_API_KEY?.trim();
  if (!apiKey) throw new Error("BAGS_API_KEY is not set");

  const connection = new Connection(RPC_URL, "confirmed");
  return new BagsSDK(apiKey, connection, "confirmed");
}

// Helper function to retry with delay
async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("All retries failed");
}

export interface LaunchTokenResult {
  tokenMint: string;
  tokenMetadata: string;
  configTransactions: string[];
  launchTransaction: string;
}

export async function launchTokenWithSDK(params: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  creatorWallet: string;
}): Promise<LaunchTokenResult> {
  const sdk = getSDK();
  const creatorPubkey = new PublicKey(params.creatorWallet);

  // Step 1: Create token metadata
  console.log("SDK Step 1: Creating token info...");
  const twitterUrl = params.twitter ? `https://x.com/${params.twitter}` : undefined;
  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    twitter: twitterUrl,
  });
  console.log("SDK Step 1 SUCCESS:", tokenInfo.tokenMint);

  // Wait a bit for the token to propagate in Bags system
  console.log("Waiting for token to propagate...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 2: Create fee share config with retry
  console.log("SDK Step 2: Creating fee share config...");
  const feeConfig = await retryWithDelay(async () => {
    return await sdk.config.createBagsFeeShareConfig({
      payer: creatorPubkey,
      baseMint: new PublicKey(tokenInfo.tokenMint),
      feeClaimers: [{ user: creatorPubkey, userBps: 10000 }],
    });
  }, 3, 3000);
  console.log("SDK Step 2 SUCCESS:", feeConfig.meteoraConfigKey.toBase58());

  // Serialize config transactions
  const configTxs = feeConfig.transactions.map((tx: VersionedTransaction) =>
    Buffer.from(tx.serialize()).toString("base64")
  );

  // Step 3: Create launch transaction
  console.log("SDK Step 3: Creating launch transaction...");
  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    tokenMint: new PublicKey(tokenInfo.tokenMint),
    launchWallet: creatorPubkey,
    initialBuyLamports: 0,
    configKey: feeConfig.meteoraConfigKey,
    metadataUrl: tokenInfo.tokenMetadata,
  });
  console.log("SDK Step 3 SUCCESS");

  const launchTxBase64 = Buffer.from(launchTx.serialize()).toString("base64");

  return {
    tokenMint: tokenInfo.tokenMint,
    tokenMetadata: tokenInfo.tokenMetadata,
    configTransactions: configTxs,
    launchTransaction: launchTxBase64,
  };
}
