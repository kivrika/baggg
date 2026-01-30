import { NextRequest, NextResponse } from "next/server";
import { createSwapTransaction } from "@/lib/bags";
import { authenticateAgent, applyAgentRateLimit } from "@/middleware/agent-auth";
import { getAgentWallet } from "@/lib/db";
import { signTransactionWithEncryptedKey } from "@/lib/agent-wallets";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteResponse, userPublicKey, autoSign } = body;

    // Try agent authentication
    const agent = await authenticateAgent(req);

    let publicKey = userPublicKey;
    let shouldAutoSign = false;

    if (agent) {
      // Agent trading - apply rate limit (10 trades per hour)
      const rateLimitResponse = applyAgentRateLimit(agent.id, 10, 60 * 60 * 1000);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // Get agent wallet
      const wallet = await getAgentWallet(agent.id);
      if (!wallet) {
        return NextResponse.json({ error: "Agent wallet not found" }, { status: 404 });
      }

      publicKey = wallet.public_key;
      shouldAutoSign = autoSign !== false; // Default to true for agents

      console.log(`[Trade] Agent ${agent.agent_username} creating swap`);
    } else {
      // Human trading
      if (!userPublicKey) {
        return NextResponse.json(
          { error: "Missing userPublicKey or agent authentication" },
          { status: 400 }
        );
      }
    }

    if (!quoteResponse) {
      return NextResponse.json({ error: "Missing quoteResponse" }, { status: 400 });
    }

    // Create swap transaction
    const swapResult = await createSwapTransaction({
      quoteResponse,
      userPublicKey: publicKey,
    });

    // Auto-sign for agents if requested
    if (agent && shouldAutoSign) {
      try {
        const wallet = await getAgentWallet(agent.id);
        if (!wallet) {
          return NextResponse.json({ error: "Agent wallet not found" }, { status: 404 });
        }

        // Decode transaction
        const txBuffer = Buffer.from(swapResult.transaction, "base64");
        let transaction: Transaction | VersionedTransaction;

        try {
          transaction = VersionedTransaction.deserialize(txBuffer);
        } catch {
          transaction = Transaction.from(txBuffer);
        }

        // Sign transaction
        const signedTx = await signTransactionWithEncryptedKey(
          transaction,
          wallet.encrypted_private_key
        );

        // Serialize back
        let signedTransaction: string;
        if (signedTx instanceof VersionedTransaction) {
          signedTransaction = Buffer.from(signedTx.serialize()).toString("base64");
        } else {
          signedTransaction = signedTx.serialize().toString("base64");
        }

        console.log(`[Trade] Agent swap transaction auto-signed`);

        return NextResponse.json({
          success: true,
          transaction: signedTransaction,
          computeUnitLimit: swapResult.computeUnitLimit,
          prioritizationFeeLamports: swapResult.prioritizationFeeLamports,
          autoSigned: true,
        });
      } catch (signError) {
        console.error("[Trade] Auto-sign failed:", signError);
        // Return unsigned transaction as fallback
      }
    }

    return NextResponse.json({ success: true, ...swapResult });
  } catch (error) {
    console.error("Swap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create swap" },
      { status: 500 }
    );
  }
}
