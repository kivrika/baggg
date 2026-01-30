// ─── Agent Authentication Middleware ────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getAgentSession, getUserById } from "@/lib/db";
import { DBUser } from "@/types";
import * as crypto from "crypto";

/**
 * Extract session token from request headers
 */
export function getSessionTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check X-Session-Token header (alternative)
  const sessionHeader = req.headers.get("x-session-token");
  if (sessionHeader) {
    return sessionHeader;
  }

  // Check body (for POST requests)
  // Note: This requires the body to be parsed first
  // Best practice is to use headers for auth tokens

  return null;
}

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
 * Authenticate agent from request
 * Returns agent user object if authenticated, null otherwise
 */
export async function authenticateAgent(req: NextRequest): Promise<DBUser | null> {
  try {
    // Get session token
    const sessionToken = getSessionTokenFromRequest(req);

    if (!sessionToken) {
      return null;
    }

    // Verify token signature
    const decoded = verifySessionToken(sessionToken);
    if (!decoded) {
      return null;
    }

    // Check if session exists in database
    const session = await getAgentSession(sessionToken);

    if (!session) {
      return null;
    }

    // Get agent user
    const agent = await getUserById(session.agent_id);

    if (!agent || agent.user_type !== "agent") {
      return null;
    }

    return agent;
  } catch (error) {
    console.error("[Agent Auth Middleware] Error:", error);
    return null;
  }
}

/**
 * Require agent authentication middleware
 * Returns 401 if not authenticated
 */
export async function requireAgentAuth(
  req: NextRequest,
  handler: (req: NextRequest, agent: DBUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const agent = await authenticateAgent(req);

  if (!agent) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Valid agent session token required.",
      },
      { status: 401 }
    );
  }

  return handler(req, agent);
}

/**
 * Optional agent authentication middleware
 * Continues even if not authenticated, but provides agent if available
 */
export async function optionalAgentAuth(
  req: NextRequest,
  handler: (req: NextRequest, agent: DBUser | null) => Promise<NextResponse>
): Promise<NextResponse> {
  const agent = await authenticateAgent(req);
  return handler(req, agent);
}

/**
 * Check if request is from an authenticated agent
 */
export async function isAuthenticatedAgent(req: NextRequest): Promise<boolean> {
  const agent = await authenticateAgent(req);
  return agent !== null;
}

/**
 * Get agent ID from request (if authenticated)
 */
export async function getAgentIdFromRequest(req: NextRequest): Promise<number | null> {
  const agent = await authenticateAgent(req);
  return agent?.id || null;
}

// ─── Rate Limiting ────────────────────────────────────────────────

interface RateLimitState {
  requests: number;
  windowStart: Date;
}

const rateLimitStore = new Map<number, RateLimitState>();

/**
 * Rate limit middleware for agents
 *
 * @param agentId - Agent ID to rate limit
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkAgentRateLimit(
  agentId: number,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = new Date();
  let state = rateLimitStore.get(agentId);

  // Initialize or reset window
  if (!state || now.getTime() - state.windowStart.getTime() >= windowMs) {
    state = {
      requests: 0,
      windowStart: now,
    };
    rateLimitStore.set(agentId, state);
  }

  // Check limit
  state.requests++;

  const allowed = state.requests <= maxRequests;
  const remaining = Math.max(0, maxRequests - state.requests);
  const resetAt = new Date(state.windowStart.getTime() + windowMs);

  return { allowed, remaining, resetAt };
}

/**
 * Apply rate limit to agent request
 */
export function applyAgentRateLimit(
  agentId: number,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  const { allowed, remaining, resetAt } = checkAgentRateLimit(agentId, maxRequests, windowMs);

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        resetAt: resetAt.toISOString(),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": resetAt.toISOString(),
        },
      }
    );
  }

  return null;
}

/**
 * Clean up old rate limit entries (maintenance)
 */
export function cleanupRateLimitStore(): void {
  const now = new Date();
  for (const [agentId, state] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now.getTime() - state.windowStart.getTime() > 60 * 60 * 1000) {
      rateLimitStore.delete(agentId);
    }
  }
}

// Clean up every 10 minutes
if (typeof window === "undefined") {
  // Server-side only
  setInterval(cleanupRateLimitStore, 10 * 60 * 1000);
}
