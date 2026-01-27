import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByPrivyId, updateUserWallet } from "@/lib/db";

// Called from the client after Privy login to register/sync user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, twitterUsername, twitterName, twitterPfp, walletAddress } = body;

    if (!privyId || !twitterUsername) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let user = getUserByPrivyId(privyId);

    if (!user) {
      // New user - create in DB
      user = createUser({
        privyId,
        twitterUsername,
        twitterName,
        twitterPfp,
        walletAddress,
      });

      return NextResponse.json({ user, isNew: true });
    }

    // Existing user - update wallet if changed
    if (walletAddress && user.wallet_address !== walletAddress) {
      updateUserWallet(privyId, walletAddress);
    }

    return NextResponse.json({ user, isNew: false });
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
