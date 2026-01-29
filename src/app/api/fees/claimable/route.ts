import { NextRequest, NextResponse } from "next/server";
import { getClaimableFees } from "@/lib/bags";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");
    const wallet = searchParams.get("wallet");

    if (!tokenMint || !wallet) {
      return NextResponse.json({ error: "Missing tokenMint or wallet" }, { status: 400 });
    }

    const fees = await getClaimableFees({ tokenMint, wallet });

    return NextResponse.json({
      success: true,
      ...fees,
    });
  } catch (error) {
    console.error("Get claimable fees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get claimable fees" },
      { status: 500 }
    );
  }
}
