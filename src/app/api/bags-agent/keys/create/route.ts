import { NextRequest, NextResponse } from "next/server";
import { createAgentApiKey } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name } = body;

    if (!token || !name) {
      return NextResponse.json(
        { error: "Missing token or key name" },
        { status: 400 }
      );
    }

    const result = await createAgentApiKey(token, name);

    return NextResponse.json({
      success: true,
      apiKey: result.apiKey,
    });
  } catch (error) {
    console.error("Create agent API key error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create agent API key",
      },
      { status: 500 }
    );
  }
}
