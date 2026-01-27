import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, updateUserToken } from "@/lib/db";
import {
  createTokenInfo,
  createFeeShareConfig,
  createLaunchTransaction,
} from "@/lib/bags";

// Launch a new coin for a user via BagsAPI
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, walletAddress } = body;

    if (!privyId || !walletAddress) {
      return NextResponse.json({ error: "Missing privyId or walletAddress" }, { status: 400 });
    }

    const user = getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.token_mint) {
      return NextResponse.json({ error: "User already has a coin", tokenMint: user.token_mint }, { status: 409 });
    }

    const tokenName = user.twitter_name || user.twitter_username;
    const tokenSymbol = `$${user.twitter_username.toUpperCase().slice(0, 8)}`;
    const description = `Social token for @${user.twitter_username} on FriendBags`;
    const imageUrl = user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png";

    // Step 1: Create token metadata
    const tokenInfo = await createTokenInfo({
      name: tokenName,
      symbol: tokenSymbol,
      description,
      imageUrl,
      twitter: user.twitter_username,
    });

    // Step 2: Create fee share config (100% to creator)
    const feeConfig = await createFeeShareConfig([
      {
        wallet: walletAddress,
        bps: 10000, // 100% to creator
      },
    ]);

    // Step 3: Create launch transaction
    const launchResult = await createLaunchTransaction({
      tokenMint: tokenInfo.tokenMint,
      launchWallet: walletAddress,
      initialBuyLamports: 0,
      configKey: feeConfig.meteoraConfigKey,
      metadataUrl: tokenInfo.tokenMetadata,
    });

    // Step 4: Update DB with token info
    updateUserToken(privyId, tokenInfo.tokenMint, tokenName, tokenSymbol);

    return NextResponse.json({
      success: true,
      tokenMint: tokenInfo.tokenMint,
      transaction: launchResult.transaction,
      tokenName,
      tokenSymbol,
    });
  } catch (error) {
    console.error("Launch coin error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to launch coin" },
      { status: 500 }
    );
  }
}
