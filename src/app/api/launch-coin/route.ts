import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, updateUserToken } from "@/lib/db";
import { launchTokenWithSDK } from "@/lib/bags-sdk";

// Launch a new coin for a user via BagsSDK
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, walletAddress } = body;

    if (!privyId || !walletAddress) {
      return NextResponse.json({ error: "Missing privyId or walletAddress" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.token_mint) {
      return NextResponse.json({ error: "User already has a coin", tokenMint: user.token_mint }, { status: 409 });
    }

    const tokenName = user.twitter_name || user.twitter_username;
    const tokenSymbol = user.twitter_username.toUpperCase().slice(0, 8);
    const description = `Social token for @${user.twitter_username} on FriendBags`;

    // Convert Twitter PFP to 400x400 version
    let imageUrl = user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png";
    imageUrl = imageUrl.replace(/_normal\.(jpg|png|gif|webp)/, "_400x400.$1")
                       .replace(/_bigger\.(jpg|png|gif|webp)/, "_400x400.$1")
                       .replace(/_mini\.(jpg|png|gif|webp)/, "_400x400.$1");

    // Use SDK to launch token
    const result = await launchTokenWithSDK({
      name: tokenName,
      symbol: tokenSymbol,
      description,
      imageUrl,
      twitter: user.twitter_username,
      creatorWallet: walletAddress,
    });

    // Update DB with token info
    await updateUserToken(privyId, result.tokenMint, tokenName, tokenSymbol);

    return NextResponse.json({
      success: true,
      tokenMint: result.tokenMint,
      configTransactions: result.configTransactions,
      launchTransaction: result.launchTransaction,
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
