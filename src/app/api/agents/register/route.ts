// ─── Agent Registration Endpoint ────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import {
  createAgent,
  createAgentWallet,
  createAgentSession,
  getUserByAgentUsername,
} from "@/lib/db";
import { createEncryptedWallet, logWalletOperation } from "@/lib/agent-wallets";
import {
  getMoltbookProfile,
  verifyMoltbookAgent,
  verifyMoltbookOAuth,
} from "@/lib/moltbook";
import { AgentRegistrationRequest, AgentRegistrationResponse } from "@/types/agent";
import * as crypto from "crypto";

/**
 * Generate JWT session token
 */
function generateSessionToken(agentId: number, agentUsername: string): string {
  // Simple JWT-like token for now
  // In production, use a proper JWT library like 'jsonwebtoken'
  const payload = {
    agentId,
    agentUsername,
    iat: Date.now(),
  };

  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto
    .createHmac("sha256", process.env.AGENT_WALLET_ENCRYPTION_KEY || "secret")
    .update(token)
    .digest("hex");

  return `${token}.${signature}`;
}

/**
 * POST /api/agents/register
 *
 * Register a new AI agent from Moltbook
 *
 * Flow:
 * 1. Verify agent exists on Moltbook (or OAuth verification)
 * 2. Check if agent already registered
 * 3. Generate server-side wallet
 * 4. Create agent user record
 * 5. Store encrypted wallet
 * 6. Create session token
 * 7. Return credentials
 */
export async function POST(req: NextRequest) {
  try {
    const body: AgentRegistrationRequest = await req.json();
    const { moltbookUsername, oauthCode } = body;

    // Validate input
    if (!moltbookUsername) {
      return NextResponse.json(
        { success: false, error: "Moltbook username is required" },
        { status: 400 }
      );
    }

    // Clean username (remove @ if present)
    const cleanUsername = moltbookUsername.replace(/^@/, "").trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 2) {
      return NextResponse.json(
        { success: false, error: "Invalid username format" },
        { status: 400 }
      );
    }

    // Check if agent already registered
    const existingAgent = await getUserByAgentUsername(cleanUsername);
    if (existingAgent) {
      return NextResponse.json(
        { success: false, error: "Agent already registered" },
        { status: 409 }
      );
    }

    // Verify agent exists on Moltbook
    let moltbookProfile;

    if (oauthCode) {
      // OAuth verification (preferred method)
      console.log(`[Agent Registration] Verifying OAuth for ${cleanUsername}`);
      const oauthResult = await verifyMoltbookOAuth(oauthCode);

      if (!oauthResult) {
        return NextResponse.json(
          { success: false, error: "Invalid OAuth code or Moltbook verification failed" },
          { status: 401 }
        );
      }

      moltbookProfile = oauthResult.profile;

      // Ensure username matches
      if (oauthResult.username !== cleanUsername) {
        return NextResponse.json(
          { success: false, error: "OAuth username does not match provided username" },
          { status: 400 }
        );
      }
    } else {
      // Simple verification (check if agent exists)
      console.log(`[Agent Registration] Verifying agent exists: ${cleanUsername}`);
      const exists = await verifyMoltbookAgent(cleanUsername);

      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Agent not found on Moltbook. Please ensure the agent exists.",
          },
          { status: 404 }
        );
      }

      // Fetch profile
      moltbookProfile = await getMoltbookProfile(cleanUsername);
    }

    // Generate server-side wallet
    console.log(`[Agent Registration] Generating wallet for ${cleanUsername}`);
    const { publicKey, encryptedPrivateKey } = createEncryptedWallet();

    logWalletOperation("create", 0, publicKey, true);

    // Create agent user record
    console.log(`[Agent Registration] Creating agent record for ${cleanUsername}`);
    const agent = await createAgent({
      agentUsername: cleanUsername,
      agentProfileData: moltbookProfile as unknown as Record<string, unknown>,
      walletAddress: publicKey,
    });

    // Store encrypted wallet
    await createAgentWallet(agent.id, publicKey, encryptedPrivateKey);

    // Generate session token (24h expiry)
    const sessionToken = generateSessionToken(agent.id, cleanUsername);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session
    await createAgentSession(agent.id, sessionToken, expiresAt);

    console.log(
      `[Agent Registration] Successfully registered agent: ${cleanUsername} (ID: ${agent.id})`
    );

    // Return success response
    const response: AgentRegistrationResponse = {
      success: true,
      sessionToken,
      walletAddress: publicKey,
      agent: {
        id: agent.id,
        username: cleanUsername,
        profileData: moltbookProfile as unknown as Record<string, unknown>,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[Agent Registration] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Agent registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/register
 *
 * Check registration status or get registration info
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json(
      { success: false, error: "Username parameter required" },
      { status: 400 }
    );
  }

  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

  try {
    // Check if agent already registered
    const agent = await getUserByAgentUsername(cleanUsername);

    if (agent) {
      return NextResponse.json({
        success: true,
        registered: true,
        agent: {
          id: agent.id,
          username: agent.agent_username,
          hasToken: !!agent.token_mint,
        },
      });
    }

    // Check if exists on Moltbook
    const exists = await verifyMoltbookAgent(cleanUsername);

    return NextResponse.json({
      success: true,
      registered: false,
      existsOnMoltbook: exists,
    });
  } catch (error) {
    console.error("[Agent Registration] Check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check registration status",
      },
      { status: 500 }
    );
  }
}
