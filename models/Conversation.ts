import mongoose, { Schema, Document, Model } from "mongoose";

// ── Types ──────────────────────────────────────────────────────────────────

export interface IConversation extends Document {
  userId: string; // Clerk user ID
  title: string;
  customInstructions: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const ConversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      maxlength: 200,
    },
    customInstructions: {
      type: String,
      default: "",
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for listing user's conversations sorted by recency
ConversationSchema.index({ userId: 1, updatedAt: -1 });

// ── Model ──────────────────────────────────────────────────────────────────

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
