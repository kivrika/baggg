import { NextRequest, NextResponse } from "next/server";
import { completeAgentLogin } from "@/lib/bags";

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

    const result = await completeAgentLogin(agentUsername);

    return NextResponse.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Agent login error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to complete agent login",
      },
      { status: 500 }
    );
  }
}
