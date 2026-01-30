import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, getPostComments, createComment } from "@/lib/db";

// GET: Get comments for a post
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "Post ID required" }, { status: 400 });
    }

    const comments = await getPostComments(parseInt(postId));

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get comments" },
      { status: 500 }
    );
  }
}

// POST: Create a new comment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, postId, content } = body;

    if (!privyId || !postId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate content length
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }
    if (trimmedContent.length > 280) {
      return NextResponse.json({ error: "Comment too long (max 280 characters)" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const comment = await createComment(postId, user.id, trimmedContent);

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
