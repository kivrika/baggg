import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, toggleLike } from "@/lib/db";

// POST: Toggle like on a post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, postId } = body;

    if (!privyId || !postId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await toggleLike(user.id, postId);

    return NextResponse.json({
      success: true,
      liked: result.liked,
      count: result.count,
    });
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to like post" },
      { status: 500 }
    );
  }
}
