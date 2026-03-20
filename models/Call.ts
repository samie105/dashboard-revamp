import mongoose, { Schema, type Document, type Model, type Types } from "mongoose"

export type CallType = "video" | "audio"

export interface ICall extends Document {
  _id: Types.ObjectId
  conversationId: Types.ObjectId
  callerId: string // Clerk user ID
  receiverId: string
  type: CallType
  status: "ringing" | "ongoing" | "completed" | "missed" | "declined" | "failed"
  meetingId?: string
  callerToken?: string
  receiverToken?: string
  duration: number
  answeredAt?: Date
  endedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const CallSchema = new Schema<ICall>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityConversation",
      required: true,
      index: true,
    },
    callerId: { type: String, required: true },
    receiverId: { type: String, required: true },
    type: { type: String, enum: ["video", "audio"], required: true },
    status: {
      type: String,
      enum: ["ringing", "ongoing", "completed", "missed", "declined", "failed"],
      default: "ringing",
    },
    meetingId: String,
    callerToken: String,
    receiverToken: String,
    duration: { type: Number, default: 0 },
    answeredAt: Date,
    endedAt: Date,
  },
  { timestamps: true },
)

CallSchema.index({ callerId: 1, status: 1 })
CallSchema.index({ receiverId: 1, status: 1 })

const Call: Model<ICall> =
  mongoose.models.Call ?? mongoose.model<ICall>("Call", CallSchema)

export default Call
