import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET: Get portfolio for a wallet - all FriendBags tokens they hold
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const privyId = searchParams.get("privyId");

    if (!wallet) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Get all users who have launched coins (these are the tokens we track)
    const usersWithCoins = await sql`
      SELECT id, twitter_username, twitter_name, twitter_pfp, token_mint, token_symbol, token_name
      FROM users
      WHERE token_mint IS NOT NULL
    `;

    if (usersWithCoins.length === 0) {
      return NextResponse.json({ success: true, holdings: [], totalValue: 0 });
    }

    // Fetch balances for each token
    const holdings = [];

    for (const user of usersWithCoins) {
      try {
        // Get token balance from Helius or RPC
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccountsByOwner",
            params: [
              wallet,
              { mint: user.token_mint },
              { encoding: "jsonParsed" }
            ]
          })
        });

        const data = await response.json();

        if (data.result?.value?.length > 0) {
          const tokenAccount = data.result.value[0];
          const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
          const balance = tokenAmount.uiAmount;
          const decimals = tokenAmount.decimals;
          const rawAmount = tokenAmount.amount; // Raw amount in smallest units

          if (balance > 0) {
            holdings.push({
              tokenMint: user.token_mint,
              tokenSymbol: user.token_symbol || user.twitter_username,
              tokenName: user.token_name,
              ownerUsername: user.twitter_username,
              ownerName: user.twitter_name,
              ownerPfp: user.twitter_pfp,
              balance,
              decimals,
              rawAmount,
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch balance for ${user.token_mint}:`, e);
      }
    }

    // Get trade history for P&L calculation if privyId provided
    let trades: { token_mint: string; trade_type: string; sol_amount: number; token_amount: number }[] = [];
    if (privyId) {
      const userRows = await sql`SELECT id FROM users WHERE privy_id = ${privyId}`;
      if (userRows.length > 0) {
        const tradeRows = await sql`
          SELECT token_mint, trade_type, sol_amount, token_amount
          FROM trades
          WHERE user_id = ${userRows[0].id}
          ORDER BY created_at ASC
        `;
        trades = tradeRows as { token_mint: string; trade_type: string; sol_amount: number; token_amount: number }[];
      }
    }

    // Calculate cost basis and P&L for each holding
    const holdingsWithPnL = holdings.map(holding => {
      const tokenTrades = trades.filter(t => t.token_mint === holding.tokenMint);

      let totalBought = 0;
      let totalSold = 0;
      let totalSpent = 0;
      let totalReceived = 0;

      for (const trade of tokenTrades) {
        if (trade.trade_type === 'buy') {
          totalBought += trade.token_amount;
          totalSpent += trade.sol_amount;
        } else {
          totalSold += trade.token_amount;
          totalReceived += trade.sol_amount;
        }
      }

      const avgBuyPrice = totalBought > 0 ? totalSpent / totalBought : 0;
      const realizedPnL = totalReceived - (totalSold * avgBuyPrice);

      return {
        ...holding,
        totalBought,
        totalSold,
        totalSpent,
        totalReceived,
        avgBuyPrice,
        realizedPnL,
      };
    });

    return NextResponse.json({
      success: true,
      holdings: holdingsWithPnL,
    });
  } catch (error) {
    console.error("Portfolio error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get portfolio" },
      { status: 500 }
    );
  }
}
