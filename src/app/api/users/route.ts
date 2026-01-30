import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getUserByPrivyId } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const privyId = searchParams.get("privyId");

    // If privyId is provided, get single user
    if (privyId) {
      const user = await getUserByPrivyId(privyId);
      return NextResponse.json({ success: true, user: user || null });
    }

    // Otherwise get all users
    const users = await getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
