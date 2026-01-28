import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/db";

export async function GET() {
  try {
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
