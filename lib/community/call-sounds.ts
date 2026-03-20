/**
 * Call sounds using Web Audio API.
 * Generates pleasant tones for call events — zero dependencies.
 */

class CallSoundManager {
  private ctx: AudioContext | null = null
  private ringInterval: ReturnType<typeof setInterval> | null = null
  private _preloaded = false

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  preload() {
    if (this._preloaded) return
    this._preloaded = true
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.01)
    } catch {
      // AudioContext not available (SSR)
    }
  }

  resume() {
    try {
      this.getContext()
    } catch {
      // AudioContext not available (SSR)
    }
  }

  private playTone(
    frequency: number,
    startOffset: number,
    duration: number,
    volume = 0.12,
    _type: OscillatorType = "sine",
  ) {
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = _type
      osc.frequency.value = frequency
      gain.gain.value = 0

      osc.connect(gain)
      gain.connect(ctx.destination)

      const start = ctx.currentTime + startOffset
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.015)
      gain.gain.setValueAtTime(volume, start + duration - 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

      osc.start(start)
      osc.stop(start + duration)
    } catch {
      // Silently fail if AudioContext unavailable
    }
  }

  startOutgoingRing() {
    this.stopRing()
    const playRingCycle = () => {
      this.playTone(440, 0, 2, 0.07)
      this.playTone(480, 0, 2, 0.07)
    }
    playRingCycle()
    this.ringInterval = setInterval(playRingCycle, 4000)
  }

  startIncomingRing() {
    this.stopRing()
    const playRingCycle = () => {
      this.playTone(523.25, 0, 0.15, 0.18)
      this.playTone(659.25, 0.16, 0.15, 0.18)
      this.playTone(523.25, 0.5, 0.15, 0.18)
      this.playTone(659.25, 0.66, 0.15, 0.18)
    }
    playRingCycle()
    this.ringInterval = setInterval(playRingCycle, 2500)
  }

  playConnected() {
    this.stopRing()
    this.playTone(523.25, 0, 0.12, 0.16)
    this.playTone(659.25, 0.1, 0.12, 0.16)
    this.playTone(783.99, 0.2, 0.22, 0.16)
  }

  playEnded() {
    this.stopRing()
    this.playTone(493.88, 0, 0.15, 0.12)
    this.playTone(392.0, 0.13, 0.15, 0.12)
    this.playTone(329.63, 0.26, 0.25, 0.1)
  }

  playDeclined() {
    this.stopRing()
    this.playTone(480, 0, 0.2, 0.12)
    this.playTone(480, 0.35, 0.2, 0.12)
  }

  playBusy() {
    this.stopRing()
    this.playTone(480, 0, 0.25, 0.15)
    this.playTone(480, 0.35, 0.25, 0.15)
    this.playTone(480, 0.7, 0.25, 0.15)
  }

  stopRing() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval)
      this.ringInterval = null
    }
  }

  stopAll() {
    this.stopRing()
  }
}

export const callSounds = new CallSoundManager()
