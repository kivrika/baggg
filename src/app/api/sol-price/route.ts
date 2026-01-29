import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );
    const data = await res.json();

    return NextResponse.json({
      success: true,
      price: data.solana?.usd || null,
    });
  } catch (error) {
    console.error("SOL price fetch error:", error);
    return NextResponse.json(
      { success: false, price: null },
      { status: 500 }
    );
  }
}
