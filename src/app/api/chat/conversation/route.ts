import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, getUserByTwitter, getConversation, markMessagesAsRead } from "@/lib/db";

// GET: Get conversation between authenticated user and another user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const privyId = searchParams.get("privyId");
    const otherUsername = searchParams.get("otherUsername");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!privyId || !otherUsername) {
      return NextResponse.json({ error: "Missing privyId or otherUsername" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const otherUser = await getUserByTwitter(otherUsername);
    if (!otherUser) {
      return NextResponse.json({ error: "Other user not found" }, { status: 404 });
    }

    // Get conversation messages
    const messages = await getConversation(user.id, otherUser.id, limit);

    // Mark messages from the other user as read
    await markMessagesAsRead(user.id, otherUser.id);

    return NextResponse.json({
      success: true,
      messages,
      otherUser: {
        id: otherUser.id,
        username: otherUser.twitter_username,
        name: otherUser.twitter_name,
        pfp: otherUser.twitter_pfp,
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get conversation" },
      { status: 500 }
    );
  }
}
