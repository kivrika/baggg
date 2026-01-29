import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const tokenMint = searchParams.get("tokenMint");

    if (!wallet || !tokenMint) {
      return NextResponse.json({ error: "Missing wallet or tokenMint" }, { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");

    // Get token accounts for this wallet and mint
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(wallet),
      { mint: new PublicKey(tokenMint) }
    );

    let balance = 0;
    let decimals = 6; // Default

    if (tokenAccounts.value.length > 0) {
      const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
      balance = accountInfo.tokenAmount.uiAmount || 0;
      decimals = accountInfo.tokenAmount.decimals;
    }

    return NextResponse.json({
      success: true,
      balance,
      decimals,
    });
  } catch (error) {
    console.error("Token balance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get balance" },
      { status: 500 }
    );
  }
}
