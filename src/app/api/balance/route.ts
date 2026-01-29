import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    const balance = lamports / LAMPORTS_PER_SOL;

    return NextResponse.json({ success: true, balance, lamports });
  } catch (error) {
    console.error("Balance fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
