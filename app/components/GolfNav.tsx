'use client'
import { useRef, useEffect, useCallback } from 'react'

// ─── Sphere constants ─────────────────────────────────────────────────────────
const R   = 200
const CW  = R + 24
const CH  = R * 2 + 80
const SCX = CW          // sphere centre at right edge of canvas
const SCY = CH / 2

const INK80  = '#1e2535'
const INK40  = '#5a6b80'
const INK25  = '#8090a0'
const ACCENT = '#c44020'

// ─── Flags: all at lon=90° so vertical (X-axis) rotation cycles them ──────────
// At lon=90° the point is (xb=0, yb=sinφ, zb=cosφ).
// X-rotation by θ: y→yb·cosθ−zb·sinθ = sin(φ−θ),  z→yb·sinθ+zb·cosθ = cos(φ−θ)
// Most visible (z=1) when θ = φ. Flag appears at canvas_x = SCX−R, canvas_y = SCY.
const FLAGS = [
  { label: 'Daily', lon: 90, lat:  56 },
  { label: 'Focus', lon: 90, lat:  26 },
  { label: 'Sound', lon: 90, lat:   0 },
  { label: 'Rest',  lon: 90, lat: -26 },
  { label: 'Play',  lon: 90, lat: -56 },
]

function targetRotX(pageIdx: number) {
  return FLAGS[pageIdx].lat * Math.PI / 180
}

// ─── Globe math ───────────────────────────────────────────────────────────────
// Viewer from −Z (looking in +Z). canvas_x = SCX − z·R, canvas_y = SCY − y·R. vis: z > 0
function globe(lon: number, lat: number, rotX: number) {
  const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180
  const xb = Math.cos(φ) * Math.cos(λ)
  const yb = Math.sin(φ)
  const zb = Math.cos(φ) * Math.sin(λ)
  const cosR = Math.cos(rotX), sinR = Math.sin(rotX)
  const y = yb * cosR - zb * sinR
  const z = yb * sinR + zb * cosR
  return { x: xb, y, z, sx: SCX - z * R, sy: SCY - y * R, vis: z > 0 }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawSphere(ctx: CanvasRenderingContext2D, rotX: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)
  ctx.lineTo(SCX, SCY - R)
  ctx.closePath()
  ctx.clip()

  const g = ctx.createRadialGradient(SCX - R * 0.58, SCY - R * 0.28, R * 0.04, SCX, SCY, R * 1.05)
  g.addColorStop(0,   '#faf6ee')
  g.addColorStop(0.4, '#f2ece0')
  g.addColorStop(0.8, '#ddd4c0')
  g.addColorStop(1,   '#c4b8a0')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH)

  // latitude rings
  for (const lat of [-60, -40, -20, 0, 20, 40, 60]) {
    ctx.beginPath(); let first = true
    for (let lon = 0; lon <= 360; lon += 5) {
      const p = globe(lon, lat, rotX)
      if (!p.vis) { first = true; continue }
      first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.11)'; ctx.lineWidth = 0.6; ctx.stroke()
  }

  // longitude arcs
  for (let lon = 0; lon < 360; lon += 30) {
    ctx.beginPath(); let first = true
    for (let lat = -88; lat <= 88; lat += 5) {
      const p = globe(lon, lat, rotX)
      if (!p.vis) { first = true; continue }
      first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)
      first = false
    }
    ctx.strokeStyle = 'rgba(62,92,185,0.11)'; ctx.lineWidth = 0.6; ctx.stroke()
  }

  ctx.restore()

  // rim
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)
  ctx.strokeStyle = 'rgba(62,92,185,0.26)'; ctx.lineWidth = 1; ctx.stroke()

  // wall-shadow
  const sh = ctx.createLinearGradient(SCX - 32, 0, CW, 0)
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.11)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(SCX, SCY, R, Math.PI * 0.5, Math.PI * 1.5)
  ctx.lineTo(SCX, SCY - R); ctx.closePath(); ctx.fill()
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  lon: number, lat: number, rotX: number,
  label: string, active: boolean, hovered: boolean,
  wave: number, idx: number,
) {
  const g = globe(lon, lat, rotX)
  if (!g.vis) return
  const alpha = Math.min(1, g.z / 0.22)
  if (alpha <= 0) return

  const sc  = 0.68 + g.z * 0.54
  const pH  = 38 * sc
  const pW  = 19 * sc
  const pHt = 12 * sc
  const wv  = Math.sin(wave * 1.4 + idx * 1.1) * 3.8 * sc

  const ink  = active ? ACCENT : hovered ? INK80 : INK40
  const fill = active ? ACCENT : hovered ? INK80 : INK25

  ctx.save()
  ctx.globalAlpha = alpha

  // pole
  ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(g.sx, g.sy - pH)
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * sc; ctx.stroke()

  // pennant
  ctx.beginPath()
  ctx.moveTo(g.sx, g.sy - pH)
  ctx.lineTo(g.sx + pW + wv, g.sy - pH + pHt * 0.45)
  ctx.lineTo(g.sx, g.sy - pH + pHt)
  ctx.closePath()
  ctx.fillStyle = fill; ctx.fill()
  if (active || hovered) {
    ctx.strokeStyle = active ? '#902010' : INK80; ctx.lineWidth = 0.8; ctx.stroke()
  }

  // label (always to the right of pole since flags are on the left face)
  const fs = Math.round(11 * sc)
  ctx.font = `600 ${fs}px 'IBM Plex Mono', monospace`
  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  ctx.fillText(label.toUpperCase(), g.sx + 6, g.sy - pH * 0.52)

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { page: number; onNavigate: (p: number) => void }

export default function GolfNav({ page, onNavigate }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef(0)
  const rotXRef    = useRef(targetRotX(0))
  const targetRef  = useRef(targetRotX(0))
  const waveRef    = useRef(0)
  const hoverRef   = useRef(-1)
  const pageRef    = useRef(page)
  const dragging   = useRef(false)
  const dragStartY = useRef(0)
  const dragStartR = useRef(0)

  useEffect(() => {
    pageRef.current = page
    let t = targetRotX(page)
    const diff = (() => { let d = t - rotXRef.current; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; return d })()
    targetRef.current = rotXRef.current + diff
  }, [page])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let last = 0

    function frame(now: number) {
      const dt = Math.min(now - last, 50); last = now
      waveRef.current += 0.0017 * dt
      rotXRef.current += (targetRef.current - rotXRef.current) * Math.min(1, 0.065 * dt / 16)

      ctx!.clearRect(0, 0, CW, CH)
      const rotX = rotXRef.current

      drawSphere(ctx!, rotX)

      // paint back-to-front by z depth
      FLAGS
        .map((f, i) => ({ ...f, z: globe(f.lon, f.lat, rotX).z, i }))
        .sort((a, b) => a.z - b.z)
        .forEach(f => drawFlag(ctx!, f.lon, f.lat, rotX, f.label,
          f.i === pageRef.current, f.i === hoverRef.current, waveRef.current, f.i))

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return -1
    const cx = clientX - rect.left, cy = clientY - rect.top
    let best = -1, bestD = 36
    FLAGS.forEach(({ lon, lat }, i) => {
      const g = globe(lon, lat, rotXRef.current); if (!g.vis) return
      const pH = 38 * (0.68 + g.z * 0.54)
      const d = Math.hypot(cx - g.sx, cy - (g.sy - pH * 0.5))
      if (d < bestD) { best = i; bestD = d }
    })
    return best
  }, [])

  const snapToNearest = useCallback(() => {
    let best = -1, bestZ = -1
    FLAGS.forEach(({ lon, lat }, i) => {
      const g = globe(lon, lat, rotXRef.current)
      if (g.vis && g.z > bestZ) { bestZ = g.z; best = i }
    })
    if (best >= 0) onNavigate(best)
  }, [onNavigate])

  return (
    <canvas
      ref={canvasRef}
      width={CW} height={CH}
      style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 90, cursor: 'grab', display: 'block', touchAction: 'none' }}
      onMouseDown={e => { dragging.current = true; dragStartY.current = e.clientY; dragStartR.current = rotXRef.current }}
      onMouseMove={e => {
        if (dragging.current) {
          // drag up = negative rotX delta (higher flags come down into view)
          rotXRef.current   = dragStartR.current + (e.clientY - dragStartY.current) / R
          targetRef.current = rotXRef.current
        } else {
          hoverRef.current = hitTest(e.clientX, e.clientY)
        }
      }}
      onMouseUp={e => {
        if (!dragging.current) return
        dragging.current = false
        if (Math.abs(e.clientY - dragStartY.current) < 6) {
          const h = hitTest(e.clientX, e.clientY); if (h >= 0) onNavigate(h)
        } else { snapToNearest() }
      }}
      onMouseLeave={() => { if (dragging.current) { dragging.current = false; snapToNearest() }; hoverRef.current = -1 }}
    />
  )
}
