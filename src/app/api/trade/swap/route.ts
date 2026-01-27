import { NextRequest, NextResponse } from "next/server";
import { createSwapTransaction } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteResponse, userPublicKey } = body;

    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json({ error: "Missing quoteResponse or userPublicKey" }, { status: 400 });
    }

    const swapResult = await createSwapTransaction({
      quoteResponse,
      userPublicKey,
    });

    return NextResponse.json({ success: true, ...swapResult });
  } catch (error) {
    console.error("Swap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create swap" },
      { status: 500 }
    );
  }
}
