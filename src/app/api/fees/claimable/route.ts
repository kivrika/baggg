import { NextRequest, NextResponse } from "next/server";
import { getClaimablePositions, getClaimStats } from "@/lib/bags";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");
    const wallet = searchParams.get("wallet");

    if (!tokenMint || !wallet) {
      return NextResponse.json({ error: "Missing tokenMint or wallet" }, { status: 400 });
    }

    // Get all claimable positions for the wallet and claim stats in parallel
    const [positions, claimStats] = await Promise.all([
      getClaimablePositions(wallet),
      getClaimStats(tokenMint).catch(() => []), // Don't fail if claim stats unavailable
    ]);

    console.log(`Found ${positions.length} claimable positions for wallet ${wallet}`);

    // Find the position for the specific token
    const position = positions.find(p => p.tokenMint === tokenMint);

    // Find total claimed for this wallet
    const walletStats = claimStats.find(s => s.wallet === wallet);
    const totalClaimed = walletStats?.totalClaimed || "0";

    if (!position) {
      console.log(`No position found for token ${tokenMint}`);
      return NextResponse.json({
        success: true,
        claimable: "0",
        claimed: totalClaimed,
        position: null,
      });
    }

    console.log(`Found position for token ${tokenMint}: ${position.claimableLamports} lamports, claimed: ${totalClaimed}`);

    return NextResponse.json({
      success: true,
      claimable: String(position.claimableLamports),
      claimed: totalClaimed,
      position: position,
    });
  } catch (error) {
    console.error("Get claimable fees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get claimable fees" },
      { status: 500 }
    );
  }
}
