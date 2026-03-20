import mongoose, { Schema, type Document, type Model, type Types } from "mongoose"

export interface ICommunityMessage extends Document {
  _id: Types.ObjectId
  conversationId: Types.ObjectId
  senderId: string // Clerk user ID (authUserId)
  receiverId: string
  content: string
  type: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  isRead: boolean
  isDelivered: boolean
  createdAt: Date
  updatedAt: Date
}

const CommunityMessageSchema = new Schema<ICommunityMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityConversation",
      required: true,
      index: true,
    },
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    content: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file"],
      default: "text",
    },
    fileUrl: String,
    fileUrls: { type: [String], default: undefined },
    fileName: String,
    fileSize: String,
    duration: String,
    waveform: { type: [Number], default: undefined },
    isRead: { type: Boolean, default: false },
    isDelivered: { type: Boolean, default: false },
  },
  { timestamps: true },
)

CommunityMessageSchema.index({ conversationId: 1, createdAt: -1 })

const CommunityMessage: Model<ICommunityMessage> =
  mongoose.models.CommunityMessage ??
  mongoose.model<ICommunityMessage>("CommunityMessage", CommunityMessageSchema)

export default CommunityMessage
