'use client'
import { useRef, useEffect } from 'react'

// ─── 6-fish shoal formation ───────────────────────────────────────────────────
// Coordinate frame: ox = forward (school's +x), oy = perpendicular
// Array is in draw order: depth ascending — background drawn first, foreground last
// Minimum clearance between any two fish: 5.375× contact distance (no overlap possible)
//
//  oy  [0]·············        [0] depth=0.42  ox=-110  oy=+52
//  +52  (back-left)
//  +32               [3]·      [1] depth=0.46  ox=-110  oy=-52
//  +16                   [4]·  [2] depth=0.58  ox=-40   oy=-32
//   0                        [5]→ [3] depth=0.62  ox=-40   oy=+32
//  -6                        [5]  [4] depth=0.80  ox=+40   oy=+16
//  -32               [2]·      [5] depth=1.00  ox=+120  oy=-6
//  -52  (back-right)
//  [1]·············
//      ox: -110      -40  +40  +120
const SCHOOL = [
  { ox: -110, oy:  52, depth: 0.42, sz: 3.78, phase: 0.000 },
  { ox: -110, oy: -52, depth: 0.46, sz: 4.14, phase: 0.333 },
  { ox:  -40, oy: -32, depth: 0.58, sz: 5.22, phase: 1.000 },
  { ox:  -40, oy:  32, depth: 0.62, sz: 5.58, phase: 0.667 },
  { ox:   40, oy:  16, depth: 0.80, sz: 7.20, phase: 1.333 },
  { ox:  120, oy:  -6, depth: 1.00, sz: 9.00, phase: 1.667 },
]

const CREATURES = ['whale', 'shark', 'dolphin'] as const
type Creature = typeof CREATURES[number]

interface CreatureState {
  type: Creature
  x: number
  y: number
  dir: 1 | -1
  speed: number
  spawnTime: number  // t at spawn — used for spawn-relative arc/weave
}

interface OceanState {
  nextCreatureAt: number
  creatureIdx: number
  creature: CreatureState | null
  fishPhase: number
}

// ─── Palette helpers ──────────────────────────────────────────────────────────
const I = (a: number) => `rgba(30,37,53,${a.toFixed(3)})`
const F = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`

// ─── Fish ─────────────────────────────────────────────────────────────────────
// Faces +x: eye and nose at +x, tail fan at −x.
// depth (0.4–1.0): scales stroke opacity and fill opacity for 3-D parallax.
function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number,
  angle: number, phase: number, depth: number,
) {
  const io = depth * 0.38 + 0.24   // ink opacity  0.40 → 0.62
  const fo = depth * 0.04 + 0.02   // fill opacity 0.04 → 0.06
  const u  = Math.sin(phase) * 0.10 // body undulation (subtle)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Body — ellipse, slightly tilted with undulation
  ctx.beginPath()
  ctx.ellipse(0, u * sz * 0.35, sz * 1.15, sz * 0.42, u * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = F(62, 92, 185, fo)
  ctx.fill()
  ctx.strokeStyle = I(io); ctx.lineWidth = 0.82; ctx.stroke()

  // Tail — at −x, forked (fork reduced to ±0.26 for schooling fish proportions)
  const tr = -sz * 1.05 + u * sz * 0.15  // tail root x, moves with body
  ctx.beginPath()
  ctx.moveTo(tr, u * sz * 0.35)
  ctx.lineTo(-sz * 1.72, -sz * 0.26)
  ctx.lineTo(-sz * 1.48, u * sz * 0.35)
  ctx.lineTo(-sz * 1.72,  sz * 0.26)
  ctx.closePath()
  ctx.fillStyle = F(62, 92, 185, fo)
  ctx.fill()
  ctx.strokeStyle = I(io * 0.72); ctx.lineWidth = 0.62; ctx.stroke()

  // Dorsal fin — from forward-center to rear
  ctx.beginPath()
  ctx.moveTo(sz * 0.04, -sz * 0.42 + u * sz * 0.22)
  ctx.quadraticCurveTo(-sz * 0.24, -sz * 0.82, -sz * 0.52, -sz * 0.42)
  ctx.strokeStyle = I(io * 0.62); ctx.lineWidth = 0.58; ctx.stroke()

  // Operculum / gill cover — curved line behind the head
  ctx.beginPath()
  ctx.moveTo(sz * 0.46, -sz * 0.28)
  ctx.bezierCurveTo(sz * 0.54, 0, sz * 0.46, sz * 0.28, sz * 0.34, sz * 0.26)
  ctx.strokeStyle = I(io * 0.52); ctx.lineWidth = 0.52; ctx.stroke()

  // Pectoral fin — ventral, just behind gill
  ctx.beginPath()
  ctx.moveTo(sz * 0.12, sz * 0.08)
  ctx.quadraticCurveTo(-sz * 0.08, sz * 0.48, -sz * 0.38, sz * 0.26)
  ctx.strokeStyle = I(io * 0.44); ctx.lineWidth = 0.52; ctx.stroke()

  // Lateral line — dashed midline (only on fish sz ≥ 5, else too small to read)
  if (sz >= 5) {
    ctx.save()
    ctx.setLineDash([sz * 0.09, sz * 0.11])
    ctx.beginPath()
    ctx.moveTo(sz * 0.34, -sz * 0.03); ctx.lineTo(-sz * 0.90, -sz * 0.03)
    ctx.strokeStyle = I(io * 0.38); ctx.lineWidth = 0.48; ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // Eye — at +x near the nose
  ctx.beginPath()
  ctx.arc(sz * 0.57, -sz * 0.04, sz * 0.10, 0, Math.PI * 2)
  ctx.fillStyle = I(Math.min(io * 1.3, 0.70)); ctx.fill()

  ctx.restore()
}

// ─── Coral fan ────────────────────────────────────────────────────────────────
function drawCoralFan(
  ctx: CanvasRenderingContext2D,
  x: number, baseY: number, h: number, flip: boolean,
) {
  const s = flip ? -1 : 1
  ctx.save(); ctx.translate(x, baseY)

  // Base rocks / substrate
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.ellipse(i * 9 * s + s * 3, 3, 7 + Math.abs(i) * 2, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = F(200, 190, 170, 0.18); ctx.fill()
    ctx.strokeStyle = I(0.13); ctx.lineWidth = 0.55; ctx.stroke()
  }

  // Stem
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(s * 4, -h * 0.22, s * 2, -h * 0.48, s * 1, -h * 0.62)
  ctx.strokeStyle = F(155, 65, 45, 0.42); ctx.lineWidth = 2.0; ctx.stroke()

  // Fan branches + cross-hatch + polyp dots
  const N = 11
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const baseAngle = -Math.PI / 2 + (t - 0.5) * Math.PI * 0.68 * s
    const len  = h * (0.55 + 0.42 * Math.sin(t * Math.PI))
    const sx   = s * 1 + Math.sin(t * Math.PI) * s * 8
    const sy   = -h * 0.62 - Math.sin(t * Math.PI) * 4
    const ex   = sx + Math.cos(baseAngle) * len
    const ey   = sy + Math.sin(baseAngle) * len
    const cx1  = sx + Math.cos(baseAngle) * len * 0.4 + s * Math.sin(i) * 5
    const cy1  = sy + Math.sin(baseAngle) * len * 0.4
    const alpha = 0.14 + Math.sin(t * Math.PI) * 0.14

    ctx.beginPath()
    ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx1, cy1, ex, ey)
    ctx.strokeStyle = F(155, 65, 45, alpha)
    ctx.lineWidth = 0.52 + Math.sin(t * Math.PI) * 0.42
    ctx.stroke()

    // Polyp calyx at branch tip (Haeckel signature detail)
    ctx.beginPath()
    ctx.arc(ex, ey, 0.85, 0, Math.PI * 2)
    ctx.fillStyle = F(155, 65, 45, 0.28); ctx.fill()

    // Cross-hatch mesh
    if (i > 0) {
      const pt = (i - 1) / (N - 1)
      const pAngle = -Math.PI / 2 + (pt - 0.5) * Math.PI * 0.68 * s
      const pLen   = h * (0.55 + 0.42 * Math.sin(pt * Math.PI))
      const psx    = s * 1 + Math.sin(pt * Math.PI) * s * 8
      const psy    = -h * 0.62 - Math.sin(pt * Math.PI) * 4
      for (let j = 1; j <= 3; j++) {
        const f  = j / 4
        const ax = sx + Math.cos(baseAngle) * len * f
        const ay = sy + Math.sin(baseAngle) * len * f
        const bx = psx + Math.cos(pAngle) * pLen * f
        const by = psy + Math.sin(pAngle) * pLen * f
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        ctx.strokeStyle = F(155, 65, 45, 0.08); ctx.lineWidth = 0.32; ctx.stroke()
      }
    }
  }

  ctx.restore()
}

// ─── Whale (humpback) ─────────────────────────────────────────────────────────
// Faces +x when dir=1 (scale(-1,1) mirrors for leftward travel).
// lt = local time since spawn (ms) — isolates oscillation from wall-clock t.
function drawWhale(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, dir: 1 | -1, lt: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)

  const fluke = Math.sin(lt * 0.00085) * 0.20  // raised to 0.20 rad (~11°) — visible

  // Body
  ctx.beginPath()
  ctx.moveTo(-sz * 2.2, 0)
  ctx.bezierCurveTo(-sz * 1.3, -sz * 0.52, sz * 0.3, -sz * 0.58, sz * 1.85, -sz * 0.22)
  ctx.bezierCurveTo(sz * 2.18, -sz * 0.06, sz * 2.1, sz * 0.18, sz * 1.65, sz * 0.38)
  ctx.bezierCurveTo(sz * 0.2, sz * 0.60, -sz * 1.1, sz * 0.52, -sz * 2.2, 0)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.35; ctx.stroke()

  // Rostrum detail
  ctx.beginPath()
  ctx.moveTo(sz * 1.85, -sz * 0.18)
  ctx.bezierCurveTo(sz * 2.05, -sz * 0.04, sz * 2.15, sz * 0.10, sz * 2.0, sz * 0.22)
  ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.88; ctx.stroke()

  // Pectoral fin (long — humpback signature, ~36% body length)
  ctx.beginPath()
  ctx.moveTo(sz * 0.55, sz * 0.28)
  ctx.bezierCurveTo(sz * 0.15, sz * 0.95, -sz * 0.65, sz * 1.58, -sz * 1.05, sz * 1.42)
  ctx.bezierCurveTo(-sz * 0.58, sz * 1.08, sz * 0.18, sz * 0.68, sz * 0.55, sz * 0.28)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.38); ctx.lineWidth = 1.0; ctx.stroke()

  // Flukes with animated rotation
  ctx.save(); ctx.translate(-sz * 2.2, 0); ctx.rotate(fluke)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-sz * 0.48, -sz * 0.28, -sz * 0.82, -sz * 0.82, -sz * 0.60, -sz * 1.04)
  ctx.bezierCurveTo(-sz * 0.22, -sz * 0.58, -sz * 0.06, -sz * 0.24, 0, 0)
  ctx.bezierCurveTo(-sz * 0.06, sz * 0.24, -sz * 0.22, sz * 0.58, -sz * 0.60, sz * 1.04)
  ctx.bezierCurveTo(-sz * 0.82, sz * 0.82, -sz * 0.48, sz * 0.28, 0, 0)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.08); ctx.fill()
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.15; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-sz * 0.14, 0); ctx.lineTo(-sz * 0.35, sz * 0.07)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.72; ctx.stroke()
  ctx.restore()

  // Throat pleats — longitudinal grooves along ventral midline
  for (let i = 0; i < 6; i++) {
    const px = sz * (0.5 - i * 0.42)
    ctx.beginPath()
    ctx.moveTo(px + sz * 0.08, sz * 0.32)
    ctx.lineTo(px - sz * 0.04, sz * 0.48)
    ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.52; ctx.stroke()
  }

  // Barnacle clusters on rostrum ridge
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc(-sz * 0.7 + i * sz * 0.32, -sz * 0.44 + Math.sin(i * 1.8) * sz * 0.07, sz * 0.038, 0, Math.PI * 2)
    ctx.fillStyle = I(0.16); ctx.fill()
  }

  // Eye
  ctx.beginPath(); ctx.arc(sz * 1.38, -sz * 0.26, sz * 0.092, 0, Math.PI * 2)
  ctx.fillStyle = I(0.55); ctx.fill()

  ctx.restore()
}

// ─── Shark ────────────────────────────────────────────────────────────────────
function drawShark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, dir: 1 | -1, lt: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)

  const tailOsc = Math.sin(lt * 0.0018) * 0.09  // tail beat oscillation

  // Body
  ctx.beginPath()
  ctx.moveTo(sz * 2.05, 0)
  ctx.bezierCurveTo(sz * 1.55, -sz * 0.30, sz * 0.35, -sz * 0.42, -sz * 1.25, -sz * 0.14)
  ctx.bezierCurveTo(-sz * 1.85, -sz * 0.04, -sz * 1.95, sz * 0.10, -sz * 1.65, sz * 0.22)
  ctx.bezierCurveTo(-sz * 0.52, sz * 0.40, sz * 1.05, sz * 0.32, sz * 1.90, sz * 0.16)
  ctx.bezierCurveTo(sz * 2.02, sz * 0.07, sz * 2.05, 0, sz * 2.05, 0)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.20; ctx.stroke()

  // Dorsal fin — closed with fill (gives it mass; it's the shark's signature)
  ctx.beginPath()
  ctx.moveTo(sz * 0.28, -sz * 0.38)
  ctx.bezierCurveTo(sz * 0.32, -sz * 0.92, sz * 0.52, -sz * 1.10, sz * 0.78, -sz * 0.38)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.08); ctx.fill()
  ctx.strokeStyle = I(0.44); ctx.lineWidth = 1.10; ctx.stroke()

  // Pectoral fin (closed)
  ctx.beginPath()
  ctx.moveTo(sz * 0.82, sz * 0.10)
  ctx.bezierCurveTo(sz * 0.50, sz * 0.55, sz * 0.08, sz * 0.72, -sz * 0.22, sz * 0.58)
  ctx.bezierCurveTo(sz * 0.08, sz * 0.36, sz * 0.60, sz * 0.22, sz * 0.82, sz * 0.10)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.08); ctx.fill()
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.90; ctx.stroke()

  // Second dorsal fin (closed)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.82, -sz * 0.16); ctx.lineTo(-sz * 0.72, -sz * 0.44); ctx.lineTo(-sz * 0.56, -sz * 0.16)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.06); ctx.fill()
  ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.82; ctx.stroke()

  // Anal fin (closed)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.95, sz * 0.22); ctx.lineTo(-sz * 0.88, sz * 0.48); ctx.lineTo(-sz * 0.72, sz * 0.22)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.06); ctx.fill()
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.72; ctx.stroke()

  // Heterocercal tail with oscillation — rotates at stock pivot
  ctx.save(); ctx.translate(-sz * 1.72, 0); ctx.rotate(tailOsc)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-sz * 2.05, -sz * 0.22, -sz * 2.52, -sz * 0.58, -sz * 2.32, -sz * 0.80)
  ctx.bezierCurveTo(-sz * 2.10, -sz * 0.52, -sz * 1.90, -sz * 0.22, 0, 0)
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-sz * 0.22, sz * 0.20, -sz * 0.45, sz * 0.38, -sz * 0.30, sz * 0.50)
  ctx.bezierCurveTo(-sz * 0.08, sz * 0.32, 0, sz * 0.16, 0, 0)
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.05; ctx.stroke()
  ctx.restore()

  // Counter-shading demarcation
  ctx.beginPath()
  ctx.moveTo(sz * 1.65, sz * 0.10)
  ctx.bezierCurveTo(sz * 0.50, sz * 0.24, -sz * 0.85, sz * 0.28, -sz * 1.55, sz * 0.14)
  ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.62; ctx.stroke()

  // Gill slits — 5 posteriorly angled curved strokes (key chondrichthyes feature)
  for (let g = 0; g < 5; g++) {
    const gx = sz * (1.04 - g * 0.15)
    ctx.beginPath()
    ctx.moveTo(gx, -sz * 0.09)
    ctx.bezierCurveTo(gx + sz * 0.035, 0, gx + sz * 0.035, 0, gx, sz * 0.11)
    ctx.strokeStyle = I(0.22); ctx.lineWidth = 0.62; ctx.stroke()
  }

  // Mouth
  ctx.beginPath()
  ctx.moveTo(sz * 1.72, sz * 0.08)
  ctx.bezierCurveTo(sz * 1.60, sz * 0.20, sz * 1.44, sz * 0.22, sz * 1.28, sz * 0.16)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.76; ctx.stroke()

  // Eye + nictitating membrane highlight
  ctx.beginPath(); ctx.arc(sz * 1.48, -sz * 0.13, sz * 0.092, 0, Math.PI * 2)
  ctx.fillStyle = I(0.68); ctx.fill()
  ctx.beginPath(); ctx.arc(sz * 1.50, -sz * 0.155, sz * 0.038, 0, Math.PI * 2)
  ctx.fillStyle = F(210, 205, 190, 0.45); ctx.fill()

  ctx.restore()
}

// ─── Dolphin ──────────────────────────────────────────────────────────────────
// bodyAngle: tilt from arc velocity — nose dips on descent, lifts on ascent.
function drawDolphin(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, dir: 1 | -1, lt: number, bodyAngle: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(bodyAngle * dir); ctx.scale(dir, 1)

  const tail = Math.sin(lt * 0.0022) * 0.14  // raised from 0.065 to 0.14 (~8°)

  // Body
  ctx.beginPath()
  ctx.moveTo(sz * 1.75, 0)
  ctx.bezierCurveTo(sz * 1.22, -sz * 0.27, sz * 0.32, -sz * 0.40, -sz * 1.28, -sz * 0.06)
  ctx.bezierCurveTo(-sz * 1.80, 0, -sz * 1.75, sz * 0.16, -sz * 1.20, sz * 0.32)
  ctx.bezierCurveTo(sz * 0.00, sz * 0.44, sz * 1.10, sz * 0.28, sz * 1.65, sz * 0.13)
  ctx.bezierCurveTo(sz * 1.78, sz * 0.06, sz * 1.78, 0, sz * 1.75, 0)
  ctx.closePath()
  ctx.fillStyle = F(165, 182, 200, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.47); ctx.lineWidth = 1.10; ctx.stroke()

  // Melon (rounded forehead)
  ctx.beginPath()
  ctx.moveTo(sz * 1.12, -sz * 0.28)
  ctx.bezierCurveTo(sz * 1.32, -sz * 0.46, sz * 1.52, -sz * 0.42, sz * 1.58, -sz * 0.22)
  ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.78; ctx.stroke()

  // Beak demarcation
  ctx.beginPath()
  ctx.moveTo(sz * 1.35, -sz * 0.14); ctx.lineTo(sz * 1.68, sz * 0.05)
  ctx.strokeStyle = I(0.18); ctx.lineWidth = 0.62; ctx.stroke()

  // Dorsal fin (falcate — curved back)
  ctx.beginPath()
  ctx.moveTo(sz * 0.16, -sz * 0.38)
  ctx.bezierCurveTo(sz * 0.26, -sz * 0.86, sz * 0.62, -sz * 0.84, sz * 0.66, -sz * 0.38)
  ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke()

  // Pectoral fin (closed)
  ctx.beginPath()
  ctx.moveTo(sz * 0.72, sz * 0.09)
  ctx.bezierCurveTo(sz * 0.42, sz * 0.52, sz * 0.06, sz * 0.64, -sz * 0.20, sz * 0.54)
  ctx.bezierCurveTo(sz * 0.06, sz * 0.34, sz * 0.52, sz * 0.20, sz * 0.72, sz * 0.09)
  ctx.closePath()
  ctx.fillStyle = F(165, 182, 200, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.34); ctx.lineWidth = 0.88; ctx.stroke()

  // Crescent tail with oscillation
  ctx.save(); ctx.translate(-sz * 1.62, 0); ctx.rotate(tail)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-sz * 0.32, -sz * 0.18, -sz * 0.56, -sz * 0.55, -sz * 0.40, -sz * 0.78)
  ctx.bezierCurveTo(-sz * 0.15, -sz * 0.50, -sz * 0.05, -sz * 0.20, 0, 0)
  ctx.bezierCurveTo(-sz * 0.05, sz * 0.20, -sz * 0.15, sz * 0.50, -sz * 0.40, sz * 0.78)
  ctx.bezierCurveTo(-sz * 0.56, sz * 0.55, -sz * 0.32, sz * 0.18, 0, 0)
  ctx.closePath()
  ctx.fillStyle = F(165, 182, 200, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke()
  ctx.restore()

  // Eye
  ctx.beginPath(); ctx.arc(sz * 1.12, -sz * 0.18, sz * 0.088, 0, Math.PI * 2)
  ctx.fillStyle = I(0.58); ctx.fill()
  ctx.beginPath(); ctx.arc(sz * 1.14, -sz * 0.205, sz * 0.038, 0, Math.PI * 2)
  ctx.fillStyle = F(225, 218, 200, 0.48); ctx.fill()

  // Smile
  ctx.beginPath()
  ctx.moveTo(sz * 1.42, sz * 0.02)
  ctx.bezierCurveTo(sz * 1.34, sz * 0.11, sz * 1.24, sz * 0.13, sz * 1.14, sz * 0.10)
  ctx.strokeStyle = I(0.20); ctx.lineWidth = 0.66; ctx.stroke()

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OceanWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let vw = 0, vh = 0

    function resize() {
      vw = window.innerWidth; vh = window.innerHeight
      canvas!.width = vw; canvas!.height = vh
    }
    resize()
    window.addEventListener('resize', resize)

    let startMs = 0, lastMs = 0

    const state: OceanState = {
      nextCreatureAt: 3500,
      creatureIdx: 0,
      creature: null,
      fishPhase: 0,
    }

    // Spawn-offscreen distances per creature type (ensures fully off-screen entry)
    const SPAWN_MULT: Record<Creature, number>  = { whale: 5.2, shark: 3.8, dolphin: 3.8 }
    const SPEEDS:     Record<Creature, number>  = { whale: 0.044, shark: 0.082, dolphin: 0.068 }
    const Y_FRACS:    Record<Creature, number>  = { whale: 0.44,  shark: 0.64,  dolphin: 0.38 }
    const SZ:         Record<Creature, number>  = { whale: 54,    shark: 38,    dolphin: 30 }

    function spawnCreature(t: number) {
      const type = CREATURES[state.creatureIdx % 3]
      const dir: 1 | -1 = state.creatureIdx % 2 === 0 ? 1 : -1
      state.creature = {
        type, dir,
        x: dir === 1 ? -SZ[type] * SPAWN_MULT[type] : vw + SZ[type] * SPAWN_MULT[type],
        y: vh * Y_FRACS[type],
        speed: SPEEDS[type],
        spawnTime: t,
      }
    }

    function frame(now: number) {
      if (!startMs) startMs = now
      const dt = Math.min(now - lastMs, 50); lastMs = now
      const t  = now - startMs

      // ── Fish school: slow elliptical drift ────────────────────────────
      const ω1 = Math.PI * 2 / 82000
      const ω2 = Math.PI * 2 / 63000
      const scx = vw * 0.5 + Math.cos(t * ω1) * vw * 0.21
      const scy = vh * 0.58 + Math.sin(t * ω2) * vh * 0.11
      const sdx = -vw * 0.21 * ω1 * Math.sin(t * ω1)   // dx/dt
      const sdy =  vh * 0.11 * ω2 * Math.cos(t * ω2)   // dy/dt
      const schoolAngle = Math.atan2(sdy, sdx)
      state.fishPhase += dt * 0.0055

      // ── Feature creature lifecycle ─────────────────────────────────────
      if (!state.creature && t >= state.nextCreatureAt) {
        spawnCreature(t)
      }
      if (state.creature) {
        const c = state.creature
        c.x += c.speed * c.dir * dt
        const margin   = SZ[c.type] * 3.0
        const offscreen = c.dir === 1 ? c.x > vw + margin : c.x < -margin
        if (offscreen) {
          state.creature = null
          state.creatureIdx++
          state.nextCreatureAt = t + 9000
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, vw, vh)

      // Coral fans — anchored at bottom corners
      const coralH = Math.min(vh * 0.13, 88)
      drawCoralFan(ctx, vw * 0.055, vh * 0.94, coralH, false)
      drawCoralFan(ctx, vw * 0.945, vh * 0.94, coralH, true)

      // Fish school — formation rotates with schoolAngle, sorted back-to-front
      const cosA = Math.cos(schoolAngle), sinA = Math.sin(schoolAngle)
      for (const f of SCHOOL) {
        const fx = scx + f.ox * cosA - f.oy * sinA
        const fy = scy + f.ox * sinA + f.oy * cosA
        // Independent per-fish tail beat: fishPhase + fish-specific offset
        drawFish(ctx, fx, fy, f.sz, schoolAngle, state.fishPhase + f.phase * Math.PI, f.depth)
      }

      // Feature creature
      if (state.creature) {
        const c = state.creature
        const lt = t - c.spawnTime   // local time since this creature spawned

        if (c.type === 'whale') {
          drawWhale(ctx, c.x, c.y, SZ.whale, c.dir, lt)
        } else if (c.type === 'shark') {
          // Spawn-relative weave so it enters straight, not mid-sway
          const weave = Math.sin(lt * 0.00082) * vh * 0.022
          drawShark(ctx, c.x, c.y + weave, SZ.shark, c.dir, lt)
        } else {
          // Dolphin arcs through water column — spawn-relative so arc starts at 0
          const arc  = Math.sin(lt * 0.00175) * vh * 0.055
          const arcV = Math.cos(lt * 0.00175) * 0.00175 * vh * 0.055  // px/ms
          // Tilt: nose tilts with velocity direction — corrected formula (removed * 68 error)
          const tilt = Math.atan2(arcV, c.speed) * 0.22
          drawDolphin(ctx, c.x, c.y + arc, SZ.dolphin, c.dir, lt, tilt)
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 6,
      }}
    />
  )
}
