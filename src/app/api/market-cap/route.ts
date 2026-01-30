import { NextRequest, NextResponse } from "next/server";
import { getTradeQuote, SOL_MINT } from "@/lib/bags";

// Cache market caps for 60 seconds to avoid excessive API calls
const cache = new Map<string, { marketCap: number; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Default total supply for pump.fun style tokens (1 billion with 6 decimals)
const DEFAULT_TOTAL_SUPPLY = 1_000_000_000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");

    if (!tokenMint) {
      return NextResponse.json({ error: "Missing tokenMint" }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(tokenMint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        marketCap: cached.marketCap,
        cached: true,
      });
    }

    // Get SOL price in USD
    const solPriceRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://friendbags.xyz'}/api/sol-price`);
    const solPriceData = await solPriceRes.json();
    const solPrice = solPriceData.price || 200; // Default to $200 if fetch fails

    // Get quote for buying tokens with 0.01 SOL to determine price
    // Using a small amount to get accurate price without slippage
    const quoteAmount = "10000000"; // 0.01 SOL in lamports

    try {
      const quote = await getTradeQuote({
        inputMint: SOL_MINT,
        outputMint: tokenMint,
        amount: quoteAmount,
      });

      // Calculate price per token in SOL
      const solAmountInLamports = parseInt(quoteAmount);
      const tokensReceivedRaw = parseInt(quote.outAmount);

      // Get token decimals from routePlan (default to 9 for Bags tokens)
      const tokenDecimals = quote.routePlan?.[0]?.outputMintDecimals ?? 9;

      console.log(`Market cap calc for ${tokenMint}: SOL lamports=${solAmountInLamports}, tokens raw=${tokensReceivedRaw}, decimals=${tokenDecimals}`);

      if (tokensReceivedRaw === 0) {
        return NextResponse.json({
          success: true,
          marketCap: 0,
        });
      }

      // Convert to proper units using actual token decimals
      // SOL: lamports / 1e9 = SOL
      // Tokens: raw / 10^decimals = whole tokens
      const solSpent = solAmountInLamports / 1e9; // 0.01 SOL
      const tokenDivisor = Math.pow(10, tokenDecimals);
      const tokensReceived = tokensReceivedRaw / tokenDivisor; // whole tokens

      // Price per whole token
      const pricePerTokenInSol = solSpent / tokensReceived;
      const pricePerTokenInUsd = pricePerTokenInSol * solPrice;

      // Market cap = price * total supply (1 billion tokens)
      const marketCap = pricePerTokenInUsd * DEFAULT_TOTAL_SUPPLY;

      console.log(`Price calc: ${solSpent} SOL for ${tokensReceived} tokens = ${pricePerTokenInSol} SOL/token = $${pricePerTokenInUsd}/token, MC=$${marketCap}`);

      // Cache the result
      cache.set(tokenMint, { marketCap, timestamp: Date.now() });

      return NextResponse.json({
        success: true,
        marketCap,
        pricePerToken: pricePerTokenInUsd,
        solPrice,
      });
    } catch (quoteError) {
      console.error("Failed to get quote for token:", tokenMint, quoteError);
      // Return 0 market cap if quote fails (token might not be tradeable yet)
      return NextResponse.json({
        success: true,
        marketCap: 0,
      });
    }
  } catch (error) {
    console.error("Get market cap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get market cap" },
      { status: 500 }
    );
  }
}

// Batch endpoint to get market caps for multiple tokens
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenMints } = body;

    if (!tokenMints || !Array.isArray(tokenMints)) {
      return NextResponse.json({ error: "Missing tokenMints array" }, { status: 400 });
    }

    // Get SOL price once
    const solPriceRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://friendbags.xyz'}/api/sol-price`);
    const solPriceData = await solPriceRes.json();
    const solPrice = solPriceData.price || 200;

    const results: Record<string, number> = {};

    // Process tokens in parallel with a limit
    const batchSize = 5;
    for (let i = 0; i < tokenMints.length; i += batchSize) {
      const batch = tokenMints.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (tokenMint: string) => {
          // Check cache first
          const cached = cache.get(tokenMint);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            results[tokenMint] = cached.marketCap;
            return;
          }

          try {
            const quoteAmount = "10000000"; // 0.01 SOL in lamports
            const quote = await getTradeQuote({
              inputMint: SOL_MINT,
              outputMint: tokenMint,
              amount: quoteAmount,
            });

            const solAmountInLamports = parseInt(quoteAmount);
            const tokensReceivedRaw = parseInt(quote.outAmount);

            // Get token decimals from routePlan (default to 9 for Bags tokens)
            const tokenDecimals = quote.routePlan?.[0]?.outputMintDecimals ?? 9;

            if (tokensReceivedRaw > 0) {
              // Convert to proper units using actual token decimals
              const solSpent = solAmountInLamports / 1e9; // SOL
              const tokenDivisor = Math.pow(10, tokenDecimals);
              const tokensReceived = tokensReceivedRaw / tokenDivisor; // whole tokens

              // Price per whole token
              const pricePerTokenInSol = solSpent / tokensReceived;
              const pricePerTokenInUsd = pricePerTokenInSol * solPrice;
              const marketCap = pricePerTokenInUsd * DEFAULT_TOTAL_SUPPLY;

              results[tokenMint] = marketCap;
              cache.set(tokenMint, { marketCap, timestamp: Date.now() });
            } else {
              results[tokenMint] = 0;
            }
          } catch {
            results[tokenMint] = 0;
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      marketCaps: results,
      solPrice,
    });
  } catch (error) {
    console.error("Batch market cap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get market caps" },
      { status: 500 }
    );
  }
}
