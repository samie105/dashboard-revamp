import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

export type UploadType = "image" | "video" | "audio"

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn,
    signableHeaders: new Set(["content-type"]),
  })
  const publicUrl = `${R2_PUBLIC_URL}/${key}`

  return { uploadUrl, publicUrl }
}

export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
    await r2Client.send(command)
    return true
  } catch (error) {
    console.error("R2 delete error:", error)
    return false
  }
}

export function generateFileKey(type: UploadType, originalFilename: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 10)
  const extension =
    originalFilename.split(".").pop()?.toLowerCase() ||
    (type === "image" ? "webp" : type === "video" ? "mp4" : "webm")
  const folder = type === "image" ? "thumbnails" : type === "video" ? "videos" : "audio"

  return `worldstreet-dashboard/${folder}/${timestamp}-${randomId}.${extension}`
}
