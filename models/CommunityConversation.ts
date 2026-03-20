import mongoose, { Schema, type Document, type Model, type Types } from "mongoose"

export interface ICommunityConversation extends Document {
  _id: Types.ObjectId
  participants: string[] // Clerk user IDs (authUserId)
  lastMessage?: Types.ObjectId
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const CommunityConversationSchema = new Schema<ICommunityConversation>(
  {
    participants: [{ type: String, required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "CommunityMessage" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

CommunityConversationSchema.index({ participants: 1 })
CommunityConversationSchema.index({ lastMessageAt: -1 })

const CommunityConversation: Model<ICommunityConversation> =
  mongoose.models.CommunityConversation ??
  mongoose.model<ICommunityConversation>("CommunityConversation", CommunityConversationSchema)

export default CommunityConversation
