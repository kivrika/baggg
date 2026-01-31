import { NextRequest, NextResponse } from "next/server";
import { initAgentAuth } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentUsername } = body;

    if (!agentUsername) {
      return NextResponse.json(
        { error: "Missing agentUsername" },
        { status: 400 }
      );
    }

    const result = await initAgentAuth(agentUsername);

    return NextResponse.json({
      success: true,
      challenge: result.challenge,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Agent auth init error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initialize agent auth",
      },
      { status: 500 }
    );
  }
}
