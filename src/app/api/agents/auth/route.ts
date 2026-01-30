// ─── Agent Authentication Endpoint ──────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import {
  getAgentSession,
  getUserById,
  createAgentSession,
  deleteAgentSession,
  deleteExpiredSessions,
} from "@/lib/db";
import { AgentAuthRequest, AgentAuthResponse } from "@/types/agent";
import * as crypto from "crypto";

/**
 * Verify session token signature
 */
function verifySessionToken(token: string): { agentId: number; agentUsername: string } | null {
  try {
    const [payload, signature] = token.split(".");

    if (!payload || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.AGENT_WALLET_ENCRYPTION_KEY || "secret")
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());

    if (!decoded.agentId || !decoded.agentUsername) {
      return null;
    }

    return {
      agentId: decoded.agentId,
      agentUsername: decoded.agentUsername,
    };
  } catch {
    return null;
  }
}

/**
 * Generate new session token
 */
function generateSessionToken(agentId: number, agentUsername: string): string {
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
 * POST /api/agents/auth
 *
 * Verify agent session token and optionally refresh it
 */
export async function POST(req: NextRequest) {
  try {
    const body: AgentAuthRequest = await req.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Session token is required" },
        { status: 400 }
      );
    }

    // Verify token signature
    const decoded = verifySessionToken(sessionToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid session token" },
        { status: 401 }
      );
    }

    // Check if session exists in database
    const session = await getAgentSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 }
      );
    }

    // Verify agent exists
    const agent = await getUserById(session.agent_id);

    if (!agent || agent.user_type !== "agent") {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    // Return success with agent info
    const response: AgentAuthResponse = {
      success: true,
      agentId: agent.id,
      agentUsername: agent.agent_username || undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent Auth] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Authentication failed",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/auth
 *
 * Refresh session token (extend expiry)
 */
export async function PUT(req: NextRequest) {
  try {
    const body: AgentAuthRequest = await req.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Session token is required" },
        { status: 400 }
      );
    }

    // Verify token
    const decoded = verifySessionToken(sessionToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid session token" },
        { status: 401 }
      );
    }

    // Check if session exists
    const session = await getAgentSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 }
      );
    }

    // Verify agent exists
    const agent = await getUserById(session.agent_id);

    if (!agent || agent.user_type !== "agent") {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    // Delete old session
    await deleteAgentSession(sessionToken);

    // Create new session with extended expiry
    const newSessionToken = generateSessionToken(agent.id, agent.agent_username!);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await createAgentSession(agent.id, newSessionToken, expiresAt);

    console.log(`[Agent Auth] Session refreshed for agent: ${agent.agent_username}`);

    return NextResponse.json({
      success: true,
      sessionToken: newSessionToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[Agent Auth] Refresh failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Session refresh failed",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/auth
 *
 * Logout / invalidate session
 */
export async function DELETE(req: NextRequest) {
  try {
    const body: AgentAuthRequest = await req.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Session token is required" },
        { status: 400 }
      );
    }

    // Delete session
    await deleteAgentSession(sessionToken);

    console.log(`[Agent Auth] Session deleted`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Agent Auth] Logout failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Logout failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/auth/cleanup
 *
 * Clean up expired sessions (maintenance endpoint)
 */
export async function GET() {
  try {
    await deleteExpiredSessions();

    return NextResponse.json({
      success: true,
      message: "Expired sessions cleaned up",
    });
  } catch (error) {
    console.error("[Agent Auth] Cleanup failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Cleanup failed",
      },
      { status: 500 }
    );
  }
}
