// ─── Agent Profile Sync Endpoint ────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { updateAgentProfile } from "@/lib/db";
import { authenticateAgent } from "@/middleware/agent-auth";
import { getMoltbookProfile, clearProfileCache } from "@/lib/moltbook";
import { shouldSyncProfile } from "@/lib/user-utils";

/**
 * POST /api/agents/sync-profile
 *
 * Manually sync agent profile from Moltbook
 * Updates cached profile data in database
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

    if (!agent.agent_username) {
      return NextResponse.json(
        { success: false, error: "Agent username not found" },
        { status: 400 }
      );
    }

    // Check rate limit (max 1 sync per 5 minutes)
    const body = await req.json().catch(() => ({}));
    const forceSync = body.force === true;

    if (!forceSync && agent.agent_last_synced_at) {
      const lastSync = new Date(agent.agent_last_synced_at);
      const now = new Date();
      const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);

      if (minutesSinceSync < 5) {
        return NextResponse.json(
          {
            success: false,
            error: "Profile was synced recently. Please wait 5 minutes between syncs.",
            lastSyncedAt: agent.agent_last_synced_at,
            nextSyncAvailableAt: new Date(
              lastSync.getTime() + 5 * 60 * 1000
            ).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    console.log(`[Agent Profile Sync] Syncing profile for ${agent.agent_username}`);

    // Clear cache to force fresh fetch
    clearProfileCache(agent.agent_username);

    // Fetch fresh profile from Moltbook
    const profile = await getMoltbookProfile(agent.agent_username);

    // Update database
    await updateAgentProfile(agent.id, profile as unknown as Record<string, unknown>);

    console.log(`[Agent Profile Sync] Successfully synced ${agent.agent_username}`);

    return NextResponse.json({
      success: true,
      profile,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Agent Profile Sync] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Profile sync failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/sync-profile
 *
 * Check if profile needs syncing
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

    const ttlMinutes = parseInt(process.env.MOLTBOOK_CACHE_TTL_MINUTES || "30");
    const needsSync = shouldSyncProfile(agent, ttlMinutes);

    return NextResponse.json({
      success: true,
      needsSync,
      lastSyncedAt: agent.agent_last_synced_at,
      ttlMinutes,
      profile: agent.agent_profile_data,
    });
  } catch (error) {
    console.error("[Agent Profile Sync] Check failed:", error);

    return NextResponse.json(
      { success: false, error: "Failed to check sync status" },
      { status: 500 }
    );
  }
}
