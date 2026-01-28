import { NextRequest, NextResponse } from "next/server";
import { clearUserTokenByWallet } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    await clearUserTokenByWallet(walletAddress);

    return NextResponse.json({ success: true, message: "Token cleared" });
  } catch (error) {
    console.error("Reset token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset token" },
      { status: 500 }
    );
  }
}
