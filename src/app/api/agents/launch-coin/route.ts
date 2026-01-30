// ─── Agent Token Launch Endpoint ────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUserToken, getAgentWallet } from "@/lib/db";
import { prepareToken, finalizeToken } from "@/lib/bags-sdk";
import { authenticateAgent } from "@/middleware/agent-auth";
import { getMoltbookProfile, getCachedProfile } from "@/lib/moltbook";
import { getKeypairFromEncrypted, signTransactionWithEncryptedKey } from "@/lib/agent-wallets";
import { MoltbookProfile } from "@/types/moltbook";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import * as bs58 from "bs58";

/**
 * POST /api/agents/launch-coin
 *
 * Agent token launch endpoint - 3-step process:
 * 1. Prepare: Create token info + fee config
 * 2. Finalize: Create launch transaction
 * 3. Confirm: Save to database
 *
 * Differences from human launch:
 * - Uses Moltbook profile data instead of Twitter
 * - Requires agent authentication (session token)
 * - Uses server-side wallet (encrypted private key)
 * - Server signs transactions automatically
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate agent
    const agent = await authenticateAgent(req);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid agent session token required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { step, tokenMint, tokenMetadata, configKey, customTicker, signedConfigTransactions } =
      body;

    // Verify agent doesn't already have a token
    if (agent.token_mint) {
      return NextResponse.json(
        { error: "Agent already has a coin", tokenMint: agent.token_mint },
        { status: 409 }
      );
    }

    // Get agent wallet
    const wallet = await getAgentWallet(agent.id);
    if (!wallet) {
      return NextResponse.json({ error: "Agent wallet not found" }, { status: 404 });
    }

    // ─── Step 3: Confirm (save to DB after successful launch) ───────
    if (step === "confirm") {
      if (!tokenMint) {
        return NextResponse.json({ error: "Missing tokenMint for confirm" }, { status: 400 });
      }

      // Get profile for token name
      const profile = agent.agent_profile_data as MoltbookProfile;
      const tokenName = profile?.display_name || agent.agent_username || "Agent Token";

      // Get ticker from body
      const tokenSymbol = customTicker
        ? customTicker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
        : (agent.agent_username || "AGENT").toUpperCase().slice(0, 10);

      await updateUserToken(agent.privy_id, tokenMint, tokenName, tokenSymbol);

      console.log(
        `[Agent Launch] Token confirmed for agent ${agent.agent_username}: ${tokenMint}`
      );

      return NextResponse.json({
        success: true,
        step: "confirm",
        tokenMint,
        tokenName,
        tokenSymbol,
      });
    }

    // ─── Step 2: Finalize (create launch transaction) ───────────────
    if (step === "finalize") {
      if (!tokenMint || !tokenMetadata || !configKey) {
        return NextResponse.json({ error: "Missing token data for finalize" }, { status: 400 });
      }

      const result = await finalizeToken({
        tokenMint,
        tokenMetadata,
        configKey,
        creatorWallet: wallet.public_key,
      });

      // Server-side sign the launch transaction
      let signedLaunchTransaction: string;

      try {
        // Decode transaction
        const txBuffer = Buffer.from(result.launchTransaction, "base64");
        let transaction: Transaction | VersionedTransaction;

        // Try to deserialize as VersionedTransaction first
        try {
          transaction = VersionedTransaction.deserialize(txBuffer);
        } catch {
          // Fallback to legacy Transaction
          transaction = Transaction.from(txBuffer);
        }

        // Sign with encrypted private key
        const signedTx = await signTransactionWithEncryptedKey(
          transaction,
          wallet.encrypted_private_key
        );

        // Serialize back to base64
        if (signedTx instanceof VersionedTransaction) {
          signedLaunchTransaction = Buffer.from(signedTx.serialize()).toString("base64");
        } else {
          signedLaunchTransaction = signedTx.serialize().toString("base64");
        }

        console.log(
          `[Agent Launch] Launch transaction signed for agent ${agent.agent_username}`
        );
      } catch (signError) {
        console.error("[Agent Launch] Transaction signing failed:", signError);
        return NextResponse.json(
          { error: "Failed to sign launch transaction" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        step: "finalize",
        launchTransaction: signedLaunchTransaction,
        tokenMint,
      });
    }

    // ─── Step 1: Prepare (create token + config) ────────────────────

    // Validate custom ticker
    if (!customTicker || customTicker.length < 2 || customTicker.length > 10) {
      return NextResponse.json({ error: "Ticker must be 2-10 characters" }, { status: 400 });
    }

    const tokenSymbol = customTicker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

    // Fetch fresh Moltbook profile
    console.log(`[Agent Launch] Fetching Moltbook profile for ${agent.agent_username}`);

    let profile: MoltbookProfile;
    try {
      // Use cached profile if recent, otherwise fetch fresh
      profile = await getCachedProfile(
        agent.agent_username!,
        parseInt(process.env.MOLTBOOK_CACHE_TTL_MINUTES || "30")
      );
    } catch (error) {
      console.error("[Agent Launch] Failed to fetch Moltbook profile:", error);
      // Fallback to stored profile data
      profile = (agent.agent_profile_data as MoltbookProfile) || {
        username: agent.agent_username!,
        display_name: agent.agent_username!,
      };
    }

    const tokenName = profile.display_name || agent.agent_username || "Agent Token";
    const description = profile.bio || `AI agent token for ${agent.agent_username} on FriendBags`;

    // Use Moltbook avatar or generate a default
    const imageUrl =
      profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.agent_username}`;

    console.log(`[Agent Launch] Preparing token for ${agent.agent_username}: ${tokenName}`);

    const result = await prepareToken({
      name: tokenName,
      symbol: tokenSymbol,
      description,
      imageUrl,
      twitter: undefined, // No Twitter for agents
      creatorWallet: wallet.public_key,
    });

    // Server-side sign config transactions
    let signedConfigTransactions: string[] = [];

    if (result.configTransactions && result.configTransactions.length > 0) {
      console.log(
        `[Agent Launch] Signing ${result.configTransactions.length} config transactions`
      );

      try {
        for (const txBase64 of result.configTransactions) {
          // Decode transaction
          const txBuffer = Buffer.from(txBase64, "base64");
          let transaction: Transaction | VersionedTransaction;

          // Try to deserialize as VersionedTransaction first
          try {
            transaction = VersionedTransaction.deserialize(txBuffer);
          } catch {
            // Fallback to legacy Transaction
            transaction = Transaction.from(txBuffer);
          }

          // Sign with encrypted private key
          const signedTx = await signTransactionWithEncryptedKey(
            transaction,
            wallet.encrypted_private_key
          );

          // Serialize back to base64
          if (signedTx instanceof VersionedTransaction) {
            signedConfigTransactions.push(Buffer.from(signedTx.serialize()).toString("base64"));
          } else {
            signedConfigTransactions.push(signedTx.serialize().toString("base64"));
          }
        }

        console.log(`[Agent Launch] All config transactions signed successfully`);
      } catch (signError) {
        console.error("[Agent Launch] Config transaction signing failed:", signError);
        return NextResponse.json(
          { error: "Failed to sign config transactions" },
          { status: 500 }
        );
      }
    }

    // Return prepared token data with signed transactions
    return NextResponse.json({
      success: true,
      step: "prepare",
      tokenMint: result.tokenMint,
      tokenMetadata: result.tokenMetadata,
      configKey: result.configKey,
      configTransactions: signedConfigTransactions, // Pre-signed by server
      tokenName,
      tokenSymbol,
    });
  } catch (error) {
    console.error("[Agent Launch] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Agent token launch failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/launch-coin
 *
 * Check if agent can launch a coin
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate agent
    const agent = await authenticateAgent(req);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if agent already has a token
    if (agent.token_mint) {
      return NextResponse.json({
        success: true,
        canLaunch: false,
        reason: "Agent already has a token",
        tokenMint: agent.token_mint,
      });
    }

    // Check if agent has a wallet
    const wallet = await getAgentWallet(agent.id);
    if (!wallet) {
      return NextResponse.json({
        success: true,
        canLaunch: false,
        reason: "Agent wallet not found",
      });
    }

    return NextResponse.json({
      success: true,
      canLaunch: true,
      walletAddress: wallet.public_key,
    });
  } catch (error) {
    console.error("[Agent Launch] Check failed:", error);

    return NextResponse.json(
      { success: false, error: "Failed to check launch eligibility" },
      { status: 500 }
    );
  }
}
