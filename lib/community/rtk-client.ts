/**
 * Module-level RTK (Dyte) client singleton.
 * Decoupled from React lifecycle — survives re-renders, HMR, and strict mode.
 */

import type { default as RTKClientInstance } from "@cloudflare/realtimekit"

type RTKEventCallback = (...args: unknown[]) => void

interface RTKClientManager {
  client: RTKClientInstance | null
  init(authToken: string, defaults?: { audio?: boolean; video?: boolean }): Promise<RTKClientInstance>
  joinRoom(): Promise<void>
  leaveRoom(): Promise<void>
  destroy(): Promise<void>
  on(event: string, target: "self" | "participants", callback: RTKEventCallback): void
  off(event: string, target: "self" | "participants", callback: RTKEventCallback): void
  offAll(): void
  isInRoom: boolean
}

let _client: RTKClientInstance | null = null
let _isInRoom = false
let _isInitializing = false
let _isJoining = false
const _listeners: Array<{
  event: string
  target: "self" | "participants"
  callback: RTKEventCallback
}> = []

let _CachedClientClass: typeof RTKClientInstance | null = null
let _preloadPromise: Promise<typeof RTKClientInstance> | null = null

export function preloadRTKSDK(): Promise<typeof RTKClientInstance> {
  if (_CachedClientClass) return Promise.resolve(_CachedClientClass)
  if (_preloadPromise) return _preloadPromise
  _preloadPromise = import("@cloudflare/realtimekit").then(({ default: C }) => {
    _CachedClientClass = C
    return C
  })
  return _preloadPromise
}

function _attachListener(event: string, target: "self" | "participants", callback: RTKEventCallback) {
  if (!_client) return
  if (target === "self") {
    _client.self.on(event as Parameters<typeof _client.self.on>[0], callback as never)
  } else if (target === "participants") {
    _client.participants.joined.on(
      event as Parameters<typeof _client.participants.joined.on>[0],
      callback as never,
    )
  }
}

function _detachListener(event: string, target: "self" | "participants", callback: RTKEventCallback) {
  if (!_client) return
  try {
    if (target === "self") {
      _client.self.removeListener(
        event as Parameters<typeof _client.self.removeListener>[0],
        callback as never,
      )
    } else if (target === "participants") {
      _client.participants.joined.removeListener(
        event as Parameters<typeof _client.participants.joined.removeListener>[0],
        callback as never,
      )
    }
  } catch {
    // Listener may already be removed
  }
}

export const rtkClient: RTKClientManager = {
  get client() {
    return _client
  },

  get isInRoom() {
    return _isInRoom
  },

  async init(authToken, defaults) {
    if (_isInitializing) {
      while (_isInitializing) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (_client) return _client
    }

    if (_client) {
      await this.destroy()
    }

    _isInitializing = true
    try {
      const ClientClass = _CachedClientClass ?? (await preloadRTKSDK())

      _client = await ClientClass.init({
        authToken,
        defaults: {
          audio: defaults?.audio ?? true,
          video: defaults?.video ?? false,
        },
      })

      for (const { event, target, callback } of _listeners) {
        _attachListener(event, target, callback)
      }

      return _client!
    } catch (err) {
      _client = null
      throw err
    } finally {
      _isInitializing = false
    }
  },

  async joinRoom() {
    if (!_client) throw new Error("RTK client not initialized")
    if (_isInRoom) return
    if (_isJoining) {
      while (_isJoining) {
        await new Promise((r) => setTimeout(r, 50))
      }
      return
    }
    _isJoining = true
    let attempts = 0
    const maxAttempts = 3
    try {
      while (attempts < maxAttempts) {
        try {
          await _client.joinRoom()
          _isInRoom = true
          return
        } catch (err) {
          attempts++
          if (attempts >= maxAttempts) throw err
          // Exponential backoff: 500ms, 1500ms
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempts - 1)))
        }
      }
    } finally {
      _isJoining = false
    }
  },

  async leaveRoom() {
    if (!_client || !_isInRoom) return
    try {
      await _client.leaveRoom()
    } catch {
      // Already left
    }
    _isInRoom = false
  },

  async destroy() {
    if (_client) {
      for (const { event, target, callback } of _listeners) {
        _detachListener(event, target, callback)
      }
      if (_isInRoom) {
        try {
          await _client.leaveRoom()
        } catch {
          // Already left
        }
      }
      _client = null
      _isInRoom = false
    }
  },

  on(event, target, callback) {
    _listeners.push({ event, target, callback })
    if (_client) {
      _attachListener(event, target, callback)
    }
  },

  off(event, target, callback) {
    const idx = _listeners.findIndex(
      (l) => l.event === event && l.target === target && l.callback === callback,
    )
    if (idx !== -1) _listeners.splice(idx, 1)
    if (_client) {
      _detachListener(event, target, callback)
    }
  },

  offAll() {
    if (_client) {
      for (const { event, target, callback } of _listeners) {
        _detachListener(event, target, callback)
      }
    }
    _listeners.length = 0
  },
}
