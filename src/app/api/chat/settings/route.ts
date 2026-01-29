import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, getUserByTwitter, getChatSettings, getChatSettingsByUsername, upsertChatSettings } from "@/lib/db";

// GET: Get chat settings by username (public) or privyId (authenticated)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const privyId = searchParams.get("privyId");

    if (username) {
      // Public query by username
      const settings = await getChatSettingsByUsername(username);
      return NextResponse.json({
        success: true,
        settings: settings || null,
      });
    }

    if (privyId) {
      // Authenticated query for own settings
      const user = await getUserByPrivyId(privyId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const settings = await getChatSettings(user.id);
      return NextResponse.json({
        success: true,
        settings: settings || null,
      });
    }

    return NextResponse.json({ error: "Missing username or privyId" }, { status: 400 });
  } catch (error) {
    console.error("Get chat settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get chat settings" },
      { status: 500 }
    );
  }
}

// POST: Update chat settings (only for coin owners)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, minTokenAmount, isEnabled } = body;

    if (!privyId) {
      return NextResponse.json({ error: "Missing privyId" }, { status: 400 });
    }

    if (minTokenAmount === undefined || isEnabled === undefined) {
      return NextResponse.json({ error: "Missing minTokenAmount or isEnabled" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only users with a token can set chat settings
    if (!user.token_mint) {
      return NextResponse.json({ error: "You need to launch a coin first" }, { status: 403 });
    }

    await upsertChatSettings(user.id, minTokenAmount, isEnabled);

    return NextResponse.json({
      success: true,
      message: "Chat settings updated",
    });
  } catch (error) {
    console.error("Update chat settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update chat settings" },
      { status: 500 }
    );
  }
}
