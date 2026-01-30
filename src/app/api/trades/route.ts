import { NextRequest, NextResponse } from "next/server";
import { getRecentTrades, createTrade, getUserByPrivyId, getTokenTrades } from "@/lib/db";

// GET: Get recent trades
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let trades;
    if (tokenMint) {
      trades = await getTokenTrades(tokenMint, limit);
    } else {
      trades = await getRecentTrades(limit, offset);
    }

    return NextResponse.json({
      success: true,
      trades,
    });
  } catch (error) {
    console.error("Get trades error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get trades" },
      { status: 500 }
    );
  }
}

// POST: Record a trade
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, tokenMint, tradeType, solAmount, tokenAmount, txSignature } = body;

    if (!privyId || !tokenMint || !tradeType || solAmount === undefined || tokenAmount === undefined || !txSignature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (tradeType !== 'buy' && tradeType !== 'sell') {
      return NextResponse.json({ error: "Invalid trade type" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const trade = await createTrade({
      userId: user.id,
      tokenMint,
      tradeType,
      solAmount,
      tokenAmount,
      txSignature,
    });

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error) {
    console.error("Create trade error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record trade" },
      { status: 500 }
    );
  }
}
