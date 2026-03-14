import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local")
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  // Already connected — fast path
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn
  }

  // Connection dropped — reset cache so we reconnect
  if (cached.conn && cached.conn.connection.readyState !== 1) {
    cached.conn = null
    cached.promise = null
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: "user-account",
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 30_000,
      connectTimeoutMS: 15_000,
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true,
      family: 4,
    })
  }

  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (e) {
    cached.promise = null
    cached.conn = null
    throw e
  }
}
