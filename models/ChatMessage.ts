import mongoose, { Schema, Document, Model, Types } from "mongoose";

// ── Types ──────────────────────────────────────────────────────────────────

export interface IAttachment {
  url: string;
  type: "image" | "document";
  filename: string;
  mimeType: string;
}

export interface IChatMessage extends Document {
  conversationId: Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: IAttachment[];
  createdAt: Date;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "document"], required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for loading conversation history in order
ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

// ── Model ──────────────────────────────────────────────────────────────────

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
