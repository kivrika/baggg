import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, updateUserToken } from "@/lib/db";
import { prepareToken, finalizeToken } from "@/lib/bags-sdk";

// Step 1: Prepare token (create token info + fee config)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, walletAddress, step, tokenMint, tokenMetadata, configKey, customTicker } = body;

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

    // Step 2: Finalize (create launch transaction)
    if (step === "finalize") {
      if (!tokenMint || !tokenMetadata || !configKey) {
        return NextResponse.json({ error: "Missing token data for finalize" }, { status: 400 });
      }

      const result = await finalizeToken({
        tokenMint,
        tokenMetadata,
        configKey,
        creatorWallet: walletAddress,
      });

      return NextResponse.json({
        success: true,
        step: "finalize",
        launchTransaction: result.launchTransaction,
        tokenMint,
      });
    }

    // Step 3: Confirm (save to DB after successful launch)
    if (step === "confirm") {
      if (!tokenMint) {
        return NextResponse.json({ error: "Missing tokenMint for confirm" }, { status: 400 });
      }

      const tokenName = user.twitter_name || user.twitter_username;
      // Get ticker from body - it should be passed through from the frontend
      const tokenSymbol = customTicker
        ? customTicker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
        : user.twitter_username.toUpperCase().slice(0, 10);

      await updateUserToken(privyId, tokenMint, tokenName, tokenSymbol);

      return NextResponse.json({
        success: true,
        step: "confirm",
        tokenMint,
        tokenName,
        tokenSymbol,
      });
    }

    // Step 1: Prepare (create token + config)
    const tokenName = user.twitter_name || user.twitter_username;

    // Use custom ticker if provided, otherwise fall back to username
    if (!customTicker || customTicker.length < 2 || customTicker.length > 10) {
      return NextResponse.json({ error: "Ticker must be 2-10 characters" }, { status: 400 });
    }
    const tokenSymbol = customTicker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

    const description = `Social token for @${user.twitter_username} on FriendBags`;

    let imageUrl = user.twitter_pfp || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png";
    imageUrl = imageUrl.replace(/_normal\.(jpg|png|gif|webp)/, "_400x400.$1")
                       .replace(/_bigger\.(jpg|png|gif|webp)/, "_400x400.$1")
                       .replace(/_mini\.(jpg|png|gif|webp)/, "_400x400.$1");

    const result = await prepareToken({
      name: tokenName,
      symbol: tokenSymbol,
      description,
      imageUrl,
      twitter: user.twitter_username,
      creatorWallet: walletAddress,
    });

    // Don't save to DB yet - only after successful launch
    return NextResponse.json({
      success: true,
      step: "prepare",
      tokenMint: result.tokenMint,
      tokenMetadata: result.tokenMetadata,
      configKey: result.configKey,
      configTransactions: result.configTransactions,
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
