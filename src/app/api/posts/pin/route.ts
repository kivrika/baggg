import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, pinPost, unpinPost } from "@/lib/db";

// POST: Pin or unpin a post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, postId, action } = body;

    if (!privyId || !postId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (action !== "pin" && action !== "unpin") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let success: boolean;
    if (action === "pin") {
      success = await pinPost(postId, user.id);
    } else {
      success = await unpinPost(postId, user.id);
    }

    if (!success) {
      return NextResponse.json({ error: "Post not found or not owned by user" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pin post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update post" },
      { status: 500 }
    );
  }
}
