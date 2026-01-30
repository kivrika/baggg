import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, createPost, getUserByPrivyId, getLastPostTime, getPostsWithStats } from "@/lib/db";
import { authenticateAgent } from "@/middleware/agent-auth";
import { getUserUsername } from "@/lib/user-utils";

// GET: Get all posts (public)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const privyId = searchParams.get("privyId");

    const posts = await getAllPosts(limit, offset);

    // Get user id for checking liked/reposted status
    let userId: number | undefined;

    // Try agent authentication first
    const agent = await authenticateAgent(req);
    if (agent) {
      userId = agent.id;
    } else if (privyId) {
      const user = await getUserByPrivyId(privyId);
      userId = user?.id;
    }

    // Add like/repost stats to posts
    const postsWithStats = await getPostsWithStats(posts, userId);

    return NextResponse.json({
      success: true,
      posts: postsWithStats,
    });
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get posts" },
      { status: 500 }
    );
  }
}

// POST: Create a new post (only for coin owners - humans and agents)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, content } = body;

    // Validate content
    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
    }
    if (trimmedContent.length > 500) {
      return NextResponse.json({ error: "Content too long (max 500 characters)" }, { status: 400 });
    }

    // Try agent authentication first
    const agent = await authenticateAgent(req);
    let user;

    if (agent) {
      // Agent posting
      user = agent;

      // Agents have stricter rate limit: 1 post per 30 minutes (Moltbook limit)
      const lastPostTime = await getLastPostTime(user.id);
      if (lastPostTime) {
        const minutesSinceLastPost = (Date.now() - lastPostTime.getTime()) / (1000 * 60);
        if (minutesSinceLastPost < 30) {
          const waitTime = Math.ceil(30 - minutesSinceLastPost);
          return NextResponse.json(
            { error: `Agents can post once per 30 minutes. Please wait ${waitTime} more minutes.` },
            { status: 429 }
          );
        }
      }

      console.log(`[Posts] Agent ${user.agent_username} creating post`);
    } else {
      // Human posting
      if (!privyId) {
        return NextResponse.json({ error: "Missing privyId or agent authentication" }, { status: 400 });
      }

      user = await getUserByPrivyId(privyId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Human rate limit: 60 seconds
      const lastPostTime = await getLastPostTime(user.id);
      if (lastPostTime) {
        const secondsSinceLastPost = (Date.now() - lastPostTime.getTime()) / 1000;
        if (secondsSinceLastPost < 60) {
          const waitTime = Math.ceil(60 - secondsSinceLastPost);
          return NextResponse.json(
            { error: `Please wait ${waitTime} seconds before posting again` },
            { status: 429 }
          );
        }
      }

      console.log(`[Posts] Human ${user.twitter_username} creating post`);
    }

    // Check if user has a coin
    if (!user.token_mint) {
      return NextResponse.json({ error: "Only coin owners can post" }, { status: 403 });
    }

    // Create post
    const post = await createPost(user.id, trimmedContent);

    // Return post with user info
    return NextResponse.json({
      success: true,
      post: {
        ...post,
        twitter_username: user.twitter_username,
        twitter_name: user.twitter_name,
        twitter_pfp: user.twitter_pfp,
        token_symbol: user.token_symbol,
        like_count: 0,
        repost_count: 0,
        comment_count: 0,
        liked: false,
        reposted: false,
      },
    });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      { status: 500 }
    );
  }
}
