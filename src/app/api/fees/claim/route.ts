import { NextRequest, NextResponse } from "next/server";
import { createClaimTransaction, getClaimablePositions } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenMint, wallet } = body;

    if (!tokenMint || !wallet) {
      return NextResponse.json({ error: "Missing tokenMint or wallet" }, { status: 400 });
    }

    // First get the claimable position to get pool details
    const positions = await getClaimablePositions(wallet);
    const position = positions.find(p => p.tokenMint === tokenMint);

    if (!position) {
      return NextResponse.json({ error: "No claimable position found for this token" }, { status: 400 });
    }

    if (position.claimableLamports === 0) {
      return NextResponse.json({ error: "No fees to claim" }, { status: 400 });
    }

    console.log("Creating claim transaction with position:", position);

    // Create claim transaction with position details
    const result = await createClaimTransaction({
      tokenMint,
      wallet,
      virtualPoolAddress: position.virtualPoolAddress,
      isCustomFeeVault: position.isCustomFeeVault,
      programId: position.programId,
      baseMint: position.baseMint,
      quoteMint: position.quoteMint,
      dammV2Position: position.dammV2Position,
      dammV2Pool: position.dammV2Pool,
      dammV2PositionNftAccount: position.dammV2PositionNftAccount,
    });

    // API returns array of transactions
    const transactions = result.transactions || [];
    console.log(`Got ${transactions.length} claim transactions`);

    return NextResponse.json({
      success: true,
      transactions,
      transaction: transactions[0], // First transaction for backwards compatibility
    });
  } catch (error) {
    console.error("Create claim transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create claim transaction" },
      { status: 500 }
    );
  }
}
