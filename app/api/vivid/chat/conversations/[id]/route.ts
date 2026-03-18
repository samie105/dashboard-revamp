import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import ChatMessage from "@/models/ChatMessage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vivid/chat/conversations/[id]
 * Fetch a conversation with its messages.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const conversation = await Conversation.findOne({
    _id: id,
    userId: authUser.userId,
  }).lean();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const messages = await ChatMessage.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({ conversation, messages });
}

/**
 * PATCH /api/vivid/chat/conversations/[id]
 * Update conversation title or custom instructions.
 * Body: { title?: string, customInstructions?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, string> = {};

  if (typeof body.title === "string") {
    updates.title = body.title.slice(0, 200);
  }
  if (typeof body.customInstructions === "string") {
    updates.customInstructions = body.customInstructions.slice(0, 2000);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: id, userId: authUser.userId },
    { $set: updates },
    { new: true }
  ).lean();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ conversation });
}

/**
 * DELETE /api/vivid/chat/conversations/[id]
 * Delete a conversation and all its messages.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const conversation = await Conversation.findOneAndDelete({
    _id: id,
    userId: authUser.userId,
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Delete all messages belonging to this conversation
  await ChatMessage.deleteMany({ conversationId: id });

  return NextResponse.json({ success: true });
}
