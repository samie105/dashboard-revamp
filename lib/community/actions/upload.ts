"use server"

import { generatePresignedUploadUrl, generateFileKey, deleteFromR2 } from "@/lib/community/r2"

export type PresignedUrlResponse = {
  success: boolean
  uploadUrl?: string
  publicUrl?: string
  key?: string
  error?: string
}

export async function getImageUploadUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUrlResponse> {
  try {
    if (!contentType.startsWith("image/")) {
      return { success: false, error: "Invalid file type. Please upload an image." }
    }
    const key = generateFileKey("image", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)
    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Image upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

export async function getVideoUploadUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUrlResponse> {
  try {
    if (!contentType.startsWith("video/")) {
      return { success: false, error: "Invalid file type. Please upload a video." }
    }
    const key = generateFileKey("video", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)
    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Video upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

export async function getAudioUploadUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUrlResponse> {
  try {
    if (!contentType.startsWith("audio/")) {
      return { success: false, error: "Invalid file type. Please upload an audio file." }
    }
    const key = generateFileKey("audio", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)
    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Audio upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

export async function deleteUploadedFile(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await deleteFromR2(key)
    if (result) return { success: true }
    return { success: false, error: "Failed to delete file" }
  } catch (error) {
    console.error("Error deleting file:", error)
    return { success: false, error: "Failed to delete file" }
  }
}
