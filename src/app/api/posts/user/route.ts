import { NextRequest, NextResponse } from "next/server";
import { getUserByTwitter, getUserPostsForProfile } from "@/lib/db";

// GET: Get posts for a user's profile
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const limit = parseInt(searchParams.get("limit") || "3");

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const user = await getUserByTwitter(username);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const posts = await getUserPostsForProfile(user.id, limit);

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error("Get user posts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get posts" },
      { status: 500 }
    );
  }
}
