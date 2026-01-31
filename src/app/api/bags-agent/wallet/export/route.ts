import { NextRequest, NextResponse } from "next/server";
import { exportAgentWallet } from "@/lib/bags";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, wallet } = body;

    if (!token || !wallet) {
      return NextResponse.json(
        { error: "Missing token or wallet address" },
        { status: 400 }
      );
    }

    const result = await exportAgentWallet(token, wallet);

    return NextResponse.json({
      success: true,
      privateKey: result.privateKey,
      address: result.address,
    });
  } catch (error) {
    console.error("Export agent wallet error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export agent wallet",
      },
      { status: 500 }
    );
  }
}
