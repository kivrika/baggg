import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, deletePost } from "@/lib/db";

// POST: Delete a post
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

    const success = await deletePost(postId, user.id);

    if (!success) {
      return NextResponse.json({ error: "Post not found or not owned by user" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete post" },
      { status: 500 }
    );
  }
}
