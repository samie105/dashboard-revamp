import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";

/**
 * GET /api/vivid/chat/conversations
 * List all conversations for the authenticated user, newest first.
 */
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const conversations = await Conversation.find({ userId: authUser.userId })
    .sort({ updatedAt: -1 })
    .select("title customInstructions createdAt updatedAt")
    .lean();

  return NextResponse.json({ conversations });
}

/**
 * POST /api/vivid/chat/conversations
 * Create a new conversation.
 * Body: { title?: string, customInstructions?: string }
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await req.json().catch(() => ({}));

  const conversation = await Conversation.create({
    userId: authUser.userId,
    title: body.title || "New Chat",
    customInstructions: body.customInstructions || "",
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
