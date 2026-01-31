import { NextRequest, NextResponse } from "next/server";
import { listAgentWallets } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Missing JWT token" },
        { status: 400 }
      );
    }

    const result = await listAgentWallets(token);

    return NextResponse.json({
      success: true,
      wallets: result.wallets,
    });
  } catch (error) {
    console.error("List agent wallets error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list agent wallets",
      },
      { status: 500 }
    );
  }
}
