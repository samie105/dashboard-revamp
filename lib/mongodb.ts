import mongoose from "mongoose"

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
  const mongodbUri = process.env.MONGODB_URI

  if (!mongodbUri) {
    throw new Error("Please define the MONGODB_URI environment variable")
  }

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
    cached.promise = mongoose.connect(mongodbUri, {
      bufferCommands: false,
      dbName: "user-account",
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 30_000,
      connectTimeoutMS: 15_000,
      maxPoolSize: 10,
      // Per *node*, not per cluster: a 3-node replica set means up to 30 sockets
      // per process. Without maxIdleTimeMS the pool only ever ratchets upward —
      // it grows to maxPoolSize under load and holds there while idle, so every
      // traffic spike permanently raises this process's floor on the cluster.
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      // Several services share this cluster and the "user-account" db. Without
      // an appName they're indistinguishable in Atlas's connection metrics.
      appName: process.env.MONGODB_APP_NAME?.trim() || "dashboard-revamp",
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
