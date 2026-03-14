import mongoose, { Schema, type Document, type Model } from "mongoose"

// ── Types ──────────────────────────────────────────────────────────────────

export interface IBankDetail {
  bankName: string
  accountNumber: string
  accountName: string
  isDefault?: boolean
}

export interface IDashboardProfile extends Document {
  authUserId: string
  email: string
  displayName: string
  avatarUrl: string
  bio: string
  savedBankDetails: IBankDetail[]
  preferredCurrency: string
  watchlist: string[]
  defaultChartInterval: string
  notifications: {
    priceAlerts: boolean
    tradeConfirmations: boolean
    marketNews: boolean
    email: boolean
    push: boolean
  }
  theme: "light" | "dark" | "system"
  dashboardLayout: "vertical" | "horizontal"
  onboardingCompleted: string[]
  createdAt: Date
  updatedAt: Date
}

// ── Schema ─────────────────────────────────────────────────────────────────

const DashboardProfileSchema = new Schema<IDashboardProfile>(
  {
    authUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    displayName: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 500 },
    savedBankDetails: {
      type: [
        {
          bankName: { type: String, required: true },
          accountNumber: { type: String, required: true },
          accountName: { type: String, required: true },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
      validate: {
        validator: (v: IBankDetail[]) => v.length <= 3,
        message: "Maximum 3 bank details allowed",
      },
    },
    preferredCurrency: { type: String, default: "USD" },
    watchlist: { type: [String], default: ["BTC", "ETH", "SOL"] },
    defaultChartInterval: { type: String, default: "1H" },
    notifications: {
      priceAlerts: { type: Boolean, default: true },
      tradeConfirmations: { type: Boolean, default: true },
      marketNews: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
    },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    dashboardLayout: { type: String, enum: ["vertical", "horizontal"], default: "vertical" },
    onboardingCompleted: { type: [String], default: [] },
  },
  { timestamps: true },
)

const DashboardProfile: Model<IDashboardProfile> =
  mongoose.models.DashboardProfile ??
  mongoose.model<IDashboardProfile>("DashboardProfile", DashboardProfileSchema)

export default DashboardProfile
