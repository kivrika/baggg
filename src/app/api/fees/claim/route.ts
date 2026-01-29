import { NextRequest, NextResponse } from "next/server";
import { createClaimTransaction } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenMint, wallet } = body;

    if (!tokenMint || !wallet) {
      return NextResponse.json({ error: "Missing tokenMint or wallet" }, { status: 400 });
    }

    const result = await createClaimTransaction({ tokenMint, wallet });

    // Handle both string and object response
    const transaction = typeof result === 'string' ? result : result.transaction;

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Create claim transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create claim transaction" },
      { status: 500 }
    );
  }
}
