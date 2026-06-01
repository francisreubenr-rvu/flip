'use client'
import { useRef, useEffect, useCallback } from 'react'

// ─── Sphere constants ─────────────────────────────────────────────────────────
const R    = 200          // sphere radius px
const CW   = R + 24       // canvas width  — shows ~half sphere + clip margin
const CH   = R * 2 + 80  // canvas height
const SCX  = CW           // sphere centre x = right edge of canvas (embedded in right wall)
const SCY  = CH / 2       // sphere centre y = canvas midpoint

// viewing: from −Z direction (viewer looks in +Z).
// visible face: z_globe > 0
// canvas_x = SCX − z_globe * R   (z=1 → leftmost visible; z=0 → sphere centre = wall)
// canvas_y = SCY − y_globe * R

const INK80  = '#1e2535'
const INK40  = '#5a6b80'
const INK25  = '#8090a0'
const ACCENT = '#c44020'

// ─── Flag definitions: lon (radians) and lat (degrees) on the sphere ──────────
// Spread evenly in longitude so rotation feels meaningful
const FLAGS = [
  { label: 'Daily', lon: 0,                   lat:  0  },
  { label: 'Focus', lon: (2 * Math.PI) / 5,   lat:  32 },
  { label: 'Sound', lon: (4 * Math.PI) / 5,   lat: -22 },
  { label: 'Rest',  lon: (6 * Math.PI) / 5,   lat:  15 },
  { label: 'Play',  lon: (8 * Math.PI) / 5,   lat: -35 },
]

// Target rotY to bring page N's flag to z_globe ≈ 0.72 (nicely centred on canvas)
const TARGET_Z = 0.72
// sin(lon + rotY) = TARGET_Z / cos(lat) → rotY = arcsin(TARGET_Z/cos(lat)) - lon
function targetRotY(pageIdx: number): number {
  const { lon, lat } = FLAGS[pageIdx]
  const cosLat = Math.cos(lat * Math.PI / 180)
  return Math.asin(Math.min(TARGET_Z / cosLat, 1)) - lon
}

// ─── Sphere maths ─────────────────────────────────────────────────────────────
function globe(lon: number, lat: number, rotY: number) {
  const φ = lat * Math.PI / 180
  const λ = lon + rotY
  const x = Math.cos(φ) * Math.cos(λ)   // depth (unused for projection)
  const y = Math.sin(φ)                  // vertical
  const z = Math.cos(φ) * Math.sin(λ)   // horizontal; z>0 = visible
  return { x, y, z, sx: SCX - z * R, sy: SCY - y * R, vis: z > 0 }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawSphere(ctx: CanvasRenderingContext2D, rotY: number) {
  ctx.save()
  // clip to visible semicircle (hemisphere = semicircle in orthographic)
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)  // left half arc
  ctx.lineTo(SCX, SCY - R)
  ctx.closePath()
  ctx.clip()

  // ── Paper gradient ─────────────────────────────────────────────
  const g = ctx.createRadialGradient(SCX - R * 0.6, SCY - R * 0.3, R * 0.05, SCX, SCY, R * 1.05)
  g.addColorStop(0,   '#faf6ee')
  g.addColorStop(0.45,'#f2ece0')
  g.addColorStop(0.8, '#ddd4c0')
  g.addColorStop(1,   '#c4b8a0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CW, CH)

  // ── Latitude rings ─────────────────────────────────────────────
  for (const lat of [-60, -40, -20, 0, 20, 40, 60]) {
    ctx.beginPath()
    let first = true
    for (let lon = 0; lon <= 360; lon += 5) {
      const { sx, sy, vis } = globe(lon * Math.PI / 180, lat, rotY)
      if (!vis) { first = true; continue }
      first ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.11)'
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  // ── Longitude arcs ─────────────────────────────────────────────
  for (let lon = 0; lon < 360; lon += 30) {
    ctx.beginPath()
    let first = true
    for (let lat = -88; lat <= 88; lat += 5) {
      const { sx, sy, vis } = globe(lon * Math.PI / 180, lat, rotY)
      if (!vis) { first = true; continue }
      first ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.11)'
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  ctx.restore()

  // ── Rim (left edge highlight) ───────────────────────────────────
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)
  ctx.strokeStyle = 'rgba(62,92,185,0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Edge shadow (right, where it meets the wall) ────────────────
  const edgeShadow = ctx.createLinearGradient(SCX - 30, 0, SCX + 10, 0)
  edgeShadow.addColorStop(0, 'rgba(0,0,0,0)')
  edgeShadow.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = edgeShadow
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)
  ctx.lineTo(SCX, SCY - R)
  ctx.closePath()
  ctx.fill()
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  lon: number, lat: number, rotY: number,
  label: string, active: boolean, hovered: boolean,
  wave: number, idx: number,
) {
  const g = globe(lon, lat, rotY)
  if (!g.vis) return

  // fade flags that are near the limb (z close to 0)
  const alpha = Math.min(1, (g.z - 0.0) / 0.25)
  if (alpha <= 0) return

  const sc   = 0.7 + g.z * 0.52        // 0.7 (limb) → 1.22 (front)
  const pH   = 36 * sc
  const pW   = 18 * sc
  const pHt  = 11 * sc
  const wv   = Math.sin(wave * 1.4 + idx * 1.1) * 3.5 * sc

  const ink  = active ? ACCENT : hovered ? INK80 : INK40
  const fill = active ? ACCENT : hovered ? INK80 : INK25

  ctx.save()
  ctx.globalAlpha = alpha

  // pole
  ctx.beginPath()
  ctx.moveTo(g.sx, g.sy)
  ctx.lineTo(g.sx, g.sy - pH)
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * sc; ctx.stroke()

  // pennant
  ctx.beginPath()
  ctx.moveTo(g.sx, g.sy - pH)
  ctx.lineTo(g.sx + pW + wv, g.sy - pH + pHt * 0.45)
  ctx.lineTo(g.sx, g.sy - pH + pHt)
  ctx.closePath()
  ctx.fillStyle = fill; ctx.fill()
  if (active || hovered) {
    ctx.strokeStyle = active ? '#902010' : INK80
    ctx.lineWidth = 0.7; ctx.stroke()
  }

  // label
  const fs = Math.round(10.5 * sc)
  ctx.font = `600 ${fs}px 'IBM Plex Mono', monospace`
  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  ctx.fillText(label.toUpperCase(), g.sx + 5, g.sy - pH * 0.55)

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  page: number
  onNavigate: (p: number) => void
}

export default function GolfNav({ page, onNavigate }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef(0)
  const rotYRef    = useRef(targetRotY(0))
  const targetRef  = useRef(targetRotY(0))
  const waveRef    = useRef(0)
  const hoverRef   = useRef(-1)
  const pageRef    = useRef(page)

  // drag state
  const dragging   = useRef(false)
  const dragStartX = useRef(0)
  const dragStartR = useRef(0)

  // sync page → target rotation
  useEffect(() => {
    pageRef.current = page
    // find shortest arc to target
    let t = targetRotY(page)
    const cur = rotYRef.current
    let diff = t - cur
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    targetRef.current = cur + diff
  }, [page])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let last = 0
    function frame(now: number) {
      const dt = Math.min(now - last, 50)
      last = now
      waveRef.current += 0.0016 * dt

      // smooth rotate toward target (ease-out)
      const diff = targetRef.current - rotYRef.current
      rotYRef.current += diff * Math.min(1, 0.06 * dt / 16)

      ctx!.clearRect(0, 0, CW, CH)
      const rotY = rotYRef.current

      drawSphere(ctx!, rotY)

      // paint flags back-to-front by z
      const sorted = FLAGS
        .map((f, i) => ({ ...f, z: globe(f.lon, f.lat, rotY).z, i }))
        .sort((a, b) => a.z - b.z)

      for (const f of sorted) {
        drawFlag(ctx!, f.lon, f.lat, rotY, f.label,
          f.i === pageRef.current,
          f.i === hoverRef.current,
          waveRef.current, f.i)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // hit-test: which flag is closest to click in canvas space?
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return -1
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    let best = -1, bestD = 34
    FLAGS.forEach(({ lon, lat }, i) => {
      const g = globe(lon, lat, rotYRef.current)
      if (!g.vis) return
      const pH = 36 * (0.7 + g.z * 0.52)
      const d  = Math.hypot(cx - g.sx, cy - (g.sy - pH * 0.5))
      if (d < bestD) { best = i; bestD = d }
    })
    return best
  }, [])

  // snap to nearest visible flag after drag
  const snapToNearest = useCallback(() => {
    let best = -1, bestZ = -1
    FLAGS.forEach(({ lon, lat }, i) => {
      const g = globe(lon, lat, rotYRef.current)
      if (g.vis && g.z > bestZ) { bestZ = g.z; best = i }
    })
    if (best >= 0) {
      onNavigate(best)
      // target already set via page prop effect; but force it here too
      let t = targetRotY(best)
      const diff = t - rotYRef.current
      let d = diff
      while (d >  Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      targetRef.current = rotYRef.current + d
    }
  }, [onNavigate])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 90,
        cursor: dragging.current ? 'grabbing' : 'grab',
        display: 'block',
        touchAction: 'none',
      }}
      onMouseDown={e => {
        dragging.current  = true
        dragStartX.current = e.clientX
        dragStartR.current = rotYRef.current
      }}
      onMouseMove={e => {
        if (dragging.current) {
          const dx = e.clientX - dragStartX.current
          rotYRef.current   = dragStartR.current - dx / R
          targetRef.current = rotYRef.current   // override target while dragging
          hoverRef.current  = -1
        } else {
          hoverRef.current = hitTest(e.clientX, e.clientY)
        }
      }}
      onMouseUp={e => {
        if (!dragging.current) return
        dragging.current = false
        const totalDrag = Math.abs(e.clientX - dragStartX.current)
        if (totalDrag < 6) {
          // it was a click, not a drag
          const h = hitTest(e.clientX, e.clientY)
          if (h >= 0) onNavigate(h)
        } else {
          snapToNearest()
        }
      }}
      onMouseLeave={() => {
        if (dragging.current) { dragging.current = false; snapToNearest() }
        hoverRef.current = -1
      }}
      onClick={() => {/* handled in onMouseUp */}}
    />
  )
}
