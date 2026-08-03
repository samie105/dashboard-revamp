"use client"

/**
 * SilkBackdrop — the caustic interference field from the mobile app, ported
 * back to WebGL. Same maths as `worldstreet-app/src/components/auth/
 * silk-backdrop.tsx` (which was itself a three.js→SkSL port), so the two
 * surfaces run the identical field.
 *
 * Tuned almost to black: it sits under a working balance and must never
 * compete with it. The tint is a dim ember rather than brand gold, the body is
 * nearly black, and the whole thing is held at low opacity — what reads is
 * slow movement in a dark field, not a colour.
 *
 * Every layer turns an INTEGER number of revolutions per loop (3/4/5/6), so
 * phase 1 renders bit-identical to phase 0 and the repeat has no seam.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uPhase;   // loop phase, 0..1
uniform vec3  uTint;    // hot core of a vein
uniform vec3  uDeep;    // the ember the field mostly sits in
uniform vec3  uBase;    // the black it all floats on

const float PI2 = 6.28318530718;

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  // cover-fit so the field doesn't stretch on wide viewports
  vec2 st = fragCoord / uResolution;
  vec2 s  = uResolution / max(uResolution.x, uResolution.y);
  vec2 uv = clamp((st - 0.5) * s + 0.5, 0.0, 1.0);

  float spectrum = -15.0;
  // ~1.6 cycles across the frame — less than one cycle reads as a single blob
  float pi = PI2 * 1.6;
  vec2  p  = mod(uv * pi, pi) - 96.0;
  vec2  i  = p;
  float c  = 0.5;
  float inten = 0.01;

  for (int n = 0; n < 4; n++) {
    float tt = PI2 * uPhase * float(n + 3);
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y),
                 sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten + spectrum),
                           p.y / (cos(i.y + tt) / inten)));
  }

  c /= 4.0;
  c = 0.05 - pow(c, 0.9);

  // The field only lands in roughly [0.13, 0.92]; these smoothsteps stretch its
  // real 5th–99th percentile across the full ramp so the median isn't black mud.
  float v    = abs(c);
  float glow = pow(smoothstep(0.319, 0.790, v), 1.7);
  float hot  = pow(smoothstep(0.611, 0.790, v), 1.4);

  // mix (not add) for the core, so a vein peaks at the tint's own hue instead
  // of clipping both R and G into acid yellow.
  vec3 col = uBase + uDeep * glow;
  col = mix(col, uTint, hot);

  // vignette, centred high — the light lives in the upper half of the frame
  float d = distance(st, vec2(0.5, 0.32));
  col *= smoothstep(1.30, 0.06, d);

  // vertical grade: gentle lift at the top, bottom sinks toward black so the
  // content zone always sits on darkness.
  col *= 1.0 + 0.20 * (1.0 - smoothstep(0.0, 0.5, st.y));
  col *= 1.0 - 0.72 * smoothstep(0.30, 1.02, st.y);

  fragColor = vec4(col, 1.0);
}
`

/** Dim ember, not brand gold — the hot core lands near #572e0d. */
const TINT: [number, number, number] = [0.34, 0.2, 0.04]
const DEEP: [number, number, number] = [0.1, 0.065, 0.018]
const BASE: [number, number, number] = [0.02, 0.018, 0.016]

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[silk] shader compile failed:", gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function SilkBackdrop({
  /** Milliseconds for one full loop. Slow — the field should drift, not animate. */
  speed = 70000,
  opacity = 0.85,
  className,
}: {
  speed?: number
  opacity?: number
  className?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Respect reduced-motion: render a single static frame instead of looping.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false })
    if (!gl) return // no WebGL2 — the CSS fallback gradient stays visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[silk] link failed:", gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    // full-screen triangle pair
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, "uResolution")
    const uPhase = gl.getUniformLocation(prog, "uPhase")
    gl.uniform3fv(gl.getUniformLocation(prog, "uTint"), TINT)
    gl.uniform3fv(gl.getUniformLocation(prog, "uDeep"), DEEP)
    gl.uniform3fv(gl.getUniformLocation(prog, "uBase"), BASE)

    // Cap the backing store — this is a soft blurry field, so half-res is free.
    const DPR_CAP = 1
    let raf = 0
    let start = 0
    let disposed = false

    function resize() {
      const r = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        gl!.viewport(0, 0, w, h)
      }
      gl!.uniform2f(uRes, canvas!.width, canvas!.height)
    }

    function frame(t: number) {
      if (disposed) return
      if (!start) start = t
      resize()
      // one slow linear sweep of phase 0→1, repeated; integer turns per layer
      // make the wrap invisible.
      gl!.uniform1f(uPhase, ((t - start) % speed) / speed)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }

    if (reduced) {
      resize()
      gl.uniform1f(uPhase, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else {
      raf = requestAnimationFrame(frame)
    }

    const ro = new ResizeObserver(() => { if (reduced) { resize(); gl.drawArrays(gl.TRIANGLES, 0, 3) } })
    ro.observe(canvas)

    // Don't burn a GPU loop on a tab nobody is looking at.
    function onVisibility() {
      if (reduced) return
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0 }
      else if (!raf) { start = 0; raf = requestAnimationFrame(frame) }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [speed])

  // The field must DISSOLVE into the page, never end on a visible edge. A mask
  // fades the whole layer out toward the bottom and both sides, so there is no
  // seam where the backdrop stops and the canvas begins.
  const fade =
    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.65) 72%, rgba(0,0,0,0) 100%)"

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{
        opacity,
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      {/* CSS fallback — also what shows if WebGL2 is unavailable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 18%, rgba(87,46,13,0.55) 0%, rgba(26,17,6,0.35) 42%, rgba(12,10,9,0) 72%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Feather the left/right edges so the field doesn't butt into the rails. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, var(--background) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 78%, var(--background) 100%)",
        }}
      />
    </div>
  )
}
