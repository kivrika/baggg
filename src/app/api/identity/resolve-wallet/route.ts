import { NextRequest, NextResponse } from "next/server";
import { resolveWalletFromUsername } from "@/lib/bags";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") as "moltbook" | "twitter" | "github";
    const username = searchParams.get("username");

    if (!provider || !username) {
      return NextResponse.json(
        { error: "Missing provider or username" },
        { status: 400 }
      );
    }

    if (!["moltbook", "twitter", "github"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be moltbook, twitter, or github" },
        { status: 400 }
      );
    }

    const result = await resolveWalletFromUsername(provider, username);

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      provider,
      username,
    });
  } catch (error) {
    console.error("Resolve wallet error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to resolve wallet from username",
      },
      { status: 500 }
    );
  }
}
