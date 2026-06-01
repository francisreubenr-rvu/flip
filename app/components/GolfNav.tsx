'use client'
import { useRef, useEffect, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const R       = 52           // sphere radius px
const CW      = 192          // canvas width
const CH      = 200          // canvas height
const SCX     = 96           // sphere centre x in canvas
const SCY     = 108          // sphere centre y (shifted down; flags poke above)
const ROT_SPD = 0.00022      // rad/ms  (~28 s / full rotation)
const TILT_X  = 22 * Math.PI / 180   // fixed X-tilt so lat rings look curved
const COS_X   = Math.cos(TILT_X)
const SIN_X   = Math.sin(TILT_X)

// colours (match design tokens)
const INK80  = '#1e2535'
const INK40  = '#5a6b80'
const INK25  = '#8090a0'
const ACCENT = '#c44020'

// ─── Flag definitions: 2D offsets from sphere centre ─────────────────────────
// placed so they form a visual diamond on the front face
const FLAG_DEFS = [
  { label: 'Daily', dx: -34, dy: -26 },
  { label: 'Focus', dx:  34, dy: -18 },
  { label: 'Sound', dx:   2, dy: -45 },
  { label: 'Rest',  dx: -32, dy:  22 },
  { label: 'Play',  dx:  32, dy:  28 },
]

// depth z from 2D position on sphere surface
function zAt(dx: number, dy: number) {
  const d2 = dx * dx + dy * dy
  return d2 < R * R ? Math.sqrt(R * R - d2) / R : 0
}

// ─── Globe drawing ────────────────────────────────────────────────────────────

// Project a 3D unit-sphere point (with Y-rotation + X-tilt) → screen
function project(lat: number, lon: number, rotY: number) {
  const φ = lat * Math.PI / 180
  const λ = lon * Math.PI / 180 + rotY
  const x3 = Math.cos(φ) * Math.cos(λ)
  const y3 = Math.sin(φ)
  const z3 = Math.cos(φ) * Math.sin(λ)
  // apply X-tilt
  const yf = y3 * COS_X - z3 * SIN_X
  const zf = y3 * SIN_X + z3 * COS_X
  return { sx: SCX + x3 * R, sy: SCY + yf * R, vis: zf > -0.05 }
}

function drawGlobe(ctx: CanvasRenderingContext2D, rotY: number) {
  ctx.save()

  // ── Clip to sphere ───────────────────────────────────────────────
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, 0, Math.PI * 2)
  ctx.clip()

  // ── Paper background ─────────────────────────────────────────────
  const grad = ctx.createRadialGradient(SCX - R * 0.3, SCY - R * 0.32, R * 0.08, SCX + R * 0.1, SCY + R * 0.1, R)
  grad.addColorStop(0,   'rgba(252,248,240,1)')
  grad.addColorStop(0.5, 'rgba(244,239,228,1)')
  grad.addColorStop(1,   'rgba(214,205,186,1)')
  ctx.fillStyle = grad
  ctx.fillRect(SCX - R, SCY - R, R * 2, R * 2)

  // ── Grid: latitude rings ──────────────────────────────────────────
  for (const lat of [-60, -30, 0, 30, 60]) {
    ctx.beginPath()
    let first = true
    for (let lon = 0; lon <= 360; lon += 6) {
      const { sx, sy, vis } = project(lat, lon, rotY)
      if (!vis) { first = true; continue }
      first ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.10)'
    ctx.lineWidth = 0.55
    ctx.stroke()
  }

  // ── Grid: longitude arcs ─────────────────────────────────────────
  for (let lon = 0; lon < 180; lon += 30) {
    ctx.beginPath()
    let first = true
    for (let lat = -90; lat <= 90; lat += 5) {
      const { sx, sy, vis } = project(lat, lon, rotY)
      if (!vis) { first = true; continue }
      first ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.10)'
    ctx.lineWidth = 0.55
    ctx.stroke()
  }

  ctx.restore()

  // ── Sphere border ─────────────────────────────────────────────────
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(62,92,185,0.22)'
  ctx.lineWidth = 0.9
  ctx.stroke()
}

// ─── Flag drawing ─────────────────────────────────────────────────────────────

function drawFlag(
  ctx: CanvasRenderingContext2D,
  dx: number, dy: number,
  label: string,
  active: boolean,
  hovered: boolean,
  wave: number,
  idx: number,
) {
  const z   = zAt(dx, dy)
  const sc  = 0.78 + z * 0.34            // 0.78 (edge) → 1.0 (near-centre)
  const sx  = SCX + dx
  const sy  = SCY + dy
  const pH  = 26 * sc                    // pole height
  const pW  = 13 * sc                    // pennant width
  const pHt = 8  * sc                    // pennant height
  const wv  = Math.sin(wave * 1.6 + idx * 1.3) * 2.8 * sc  // flag wave

  const ink  = active ? ACCENT : hovered ? INK80 : INK40
  const fill = active ? ACCENT : hovered ? INK80 : INK25

  ctx.save()

  // pole
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(sx, sy - pH)
  ctx.strokeStyle = ink
  ctx.lineWidth = 1.1 * sc
  ctx.stroke()

  // pennant (waves)
  ctx.beginPath()
  ctx.moveTo(sx, sy - pH)
  ctx.lineTo(sx + pW + wv, sy - pH + pHt * 0.42)
  ctx.lineTo(sx, sy - pH + pHt)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (active || hovered) {
    ctx.strokeStyle = active ? '#902010' : INK80
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  // label (left-of-pole for left flags, right for right flags)
  const leftSide = dx < 4
  const fs = Math.round(8.5 * sc)
  ctx.font = `600 ${fs}px 'IBM Plex Mono', monospace`
  ctx.textAlign = leftSide ? 'right' : 'left'
  ctx.fillStyle = ink
  ctx.fillText(label.toUpperCase(), leftSide ? sx - 5 : sx + 5, sy - pH * 0.46)

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  page: number
  onNavigate: (p: number) => void
}

export default function GolfNav({ page, onNavigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const rotYRef   = useRef(0)
  const waveRef   = useRef(0)
  const hoverRef  = useRef(-1)
  const pageRef   = useRef(page)

  // keep pageRef current without restarting the RAF loop
  useEffect(() => { pageRef.current = page }, [page])

  // hit-test: which flag is nearest to canvas-local (cx, cy)?
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return -1
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    let best = -1, bestD = 26
    FLAG_DEFS.forEach(({ dx, dy }, i) => {
      const sx = SCX + dx, sy = SCY + dy
      const pH = 26 * (0.78 + zAt(dx, dy) * 0.34)
      // check pole midpoint
      const d = Math.hypot(cx - sx, cy - (sy - pH * 0.5))
      if (d < bestD) { best = i; bestD = d }
    })
    return best
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let last = 0
    function frame(now: number) {
      const dt = Math.min(now - last, 50)
      last = now
      rotYRef.current += ROT_SPD * dt
      waveRef.current += 0.0018 * dt

      ctx!.clearRect(0, 0, CW, CH)
      drawGlobe(ctx!, rotYRef.current)

      // draw flags back-to-front (painter's algorithm by z)
      const sorted = FLAG_DEFS
        .map((f, i) => ({ ...f, z: zAt(f.dx, f.dy), i }))
        .sort((a, b) => a.z - b.z)

      for (const f of sorted) {
        drawFlag(ctx!, f.dx, f.dy, f.label, f.i === pageRef.current, f.i === hoverRef.current, waveRef.current, f.i)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])   // runs once; reads live refs inside

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onClick={e => { const h = hitTest(e.clientX, e.clientY); if (h >= 0) onNavigate(h) }}
      onMouseMove={e => { hoverRef.current = hitTest(e.clientX, e.clientY) }}
      onMouseLeave={() => { hoverRef.current = -1 }}
      style={{
        position: 'fixed',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 90,
        cursor: 'pointer',
        display: 'block',
      }}
    />
  )
}
