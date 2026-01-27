import { NextRequest, NextResponse } from "next/server";
import { getTradeQuote, SOL_MINT } from "@/lib/bags";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");
    const amount = searchParams.get("amount");
    const side = searchParams.get("side"); // "buy" or "sell"

    if (!tokenMint || !amount || !side) {
      return NextResponse.json({ error: "Missing tokenMint, amount, or side" }, { status: 400 });
    }

    const isBuy = side === "buy";
    const quote = await getTradeQuote({
      inputMint: isBuy ? SOL_MINT : tokenMint,
      outputMint: isBuy ? tokenMint : SOL_MINT,
      amount,
      slippageMode: "auto",
    });

    return NextResponse.json({ success: true, quote });
  } catch (error) {
    console.error("Trade quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get quote" },
      { status: 500 }
    );
  }
}
