'use client'
import { useRef, useEffect } from 'react'
import { v2, step, separate, align, cohere, seek, flee, wander, type Vec2, type Boid } from '../lib/physics'

// ─── Depth system (z ∈ [0,1]: 0=far, 1=glass) ────────────────────────────────
const dAlpha = (z: number) => 0.10 + z * 0.90
const dScale = (z: number) => 0.22 + z * 0.78
const dSpeed = (z: number) => 0.18 + z * 0.82

// ─── Palette ──────────────────────────────────────────────────────────────────
const I  = (a: number) => `rgba(30,37,53,${a.toFixed(3)})`
const F  = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`
const Gr = (a: number) => F(72, 125, 82, a)
const Lv = (a: number) => F(148, 118, 188, a)
const Or = (a: number) => F(220, 105, 30, a)
const Rs = (a: number) => F(185, 72, 50, a)

// ─── Seeds (deterministic — no Math.random at module level) ──────────────────
const SCHOOL = [
  { ox: -110, oy:  52, depth: 0.42, sz: 3.78, phase: 0.000 },
  { ox: -110, oy: -52, depth: 0.46, sz: 4.14, phase: 0.333 },
  { ox:  -40, oy: -32, depth: 0.58, sz: 5.22, phase: 1.000 },
  { ox:  -40, oy:  32, depth: 0.62, sz: 5.58, phase: 0.667 },
  { ox:   40, oy:  16, depth: 0.80, sz: 7.20, phase: 1.333 },
  { ox:  120, oy:  -6, depth: 1.00, sz: 9.00, phase: 1.667 },
  { ox:   80, oy:  42, depth: 0.72, sz: 6.48, phase: 0.500 },
  { ox:  -80, oy:   8, depth: 0.55, sz: 4.95, phase: 0.888 },
  { ox:    0, oy: -48, depth: 0.50, sz: 4.50, phase: 0.222 },
  { ox:   60, oy: -28, depth: 0.65, sz: 5.85, phase: 1.111 },
  { ox: -160, oy:  22, depth: 0.38, sz: 3.42, phase: 1.555 },
  { ox:  -60, oy:  58, depth: 0.52, sz: 4.68, phase: 0.777 },
]

const GHOST_SEEDS = Array.from({ length: 22 }, (_, i) => ({
  xFrac:  0.04 + (i * 0.618033988) % 0.92,
  yFrac:  0.22 + Math.abs(Math.sin(i * 2.391)) * 0.50,
  sz:     3.0  + Math.abs(Math.sin(i * 1.732)) * 2.8,
  speed:  0.011 + Math.abs(Math.sin(i * 3.141)) * 0.009,
  dir:    (i % 2 === 0 ? 1 : -1) as 1|-1,
  phase:  i * 0.628,
  zLayer: 0.09 + Math.abs(Math.sin(i * 0.937)) * 0.10,
}))

const JELLY_SEEDS = Array.from({ length: 6 }, (_, i) => ({
  xFrac:    0.10 + (i * 0.618033988) % 0.80,
  yFrac:    0.15 + Math.abs(Math.sin(i * 2.111)) * 0.38,
  sz:       12 + Math.abs(Math.sin(i * 2.736)) * 20,
  phase:    i * 1.047,
  driftDir: (i % 2 === 0 ? 1 : -1) as 1|-1,
  zLayer:   0.48 + Math.abs(Math.sin(i * 1.414)) * 0.40,
}))

const CAUSTIC_SEEDS = Array.from({ length: 28 }, (_, i) => ({
  xFrac:  (i * 0.618033988) % 1.0,
  yFrac:  0.02 + Math.abs(Math.sin(i * 1.618)) * 0.58,
  rFrac:  0.012 + Math.abs(Math.sin(i * 2.39)) * 0.028,
  vxSign: (i % 2 === 0 ? 1 : -1) as 1|-1,
  vySign: (i % 3 === 0 ? 1 : -1) as 1|-1,
  phase:  i * 0.449,
}))

const CREATURES = ['whale', 'shark', 'dolphin', 'manta', 'turtle', 'stingray', 'pufferfish', 'anglerfish'] as const
type Creature = typeof CREATURES[number]

// Spawn parameters per type
const SPAWNDEF: Record<Creature, { sz: number; yFrac: number; speed: number; zLayer: number; spawnMult: number; drag: number; maxSpd: number }> = {
  whale:      { sz: 54,  yFrac: 0.44, speed: 0.044, zLayer: 0.45, spawnMult: 5.5, drag: 0.980, maxSpd: 0.035 },
  shark:      { sz: 38,  yFrac: 0.64, speed: 0.082, zLayer: 0.72, spawnMult: 4.0, drag: 0.960, maxSpd: 0.100 },
  dolphin:    { sz: 30,  yFrac: 0.38, speed: 0.068, zLayer: 0.75, spawnMult: 4.0, drag: 0.970, maxSpd: 0.080 },
  manta:      { sz: 72,  yFrac: 0.50, speed: 0.048, zLayer: 0.60, spawnMult: 6.2, drag: 0.982, maxSpd: 0.055 },
  turtle:     { sz: 26,  yFrac: 0.58, speed: 0.028, zLayer: 0.65, spawnMult: 3.8, drag: 0.978, maxSpd: 0.032 },
  stingray:   { sz: 44,  yFrac: 0.82, speed: 0.040, zLayer: 0.82, spawnMult: 5.0, drag: 0.975, maxSpd: 0.048 },
  pufferfish: { sz: 16,  yFrac: 0.68, speed: 0.020, zLayer: 0.88, spawnMult: 2.5, drag: 0.965, maxSpd: 0.024 },
  anglerfish: { sz: 28,  yFrac: 0.76, speed: 0.025, zLayer: 0.28, spawnMult: 3.5, drag: 0.980, maxSpd: 0.028 },
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FishBoid extends Boid { sz: number; depth: number; phase: number; wanderTheta: number }
interface CreatureBoid extends Boid {
  type: Creature; dir: 1|-1; sz: number; spawnTime: number; lt: number
  state: string; stateTimer: number; bodyAngle: number; wanderTheta: number; lastBreachAt: number
  inflated: boolean
}
interface GhostFish   { x: number; y: number; sz: number; speed: number; dir: 1|-1; phase: number; zLayer: number }
interface CausticCell { cx: number; cy: number; vx: number; vy: number; r: number; phase: number }
interface JellyState  { x: number; y: number; sz: number; phase: number; driftDir: 1|-1; zLayer: number }
interface BubbleState { x: number; y: number; r: number; speed: number; wobble: number; life: number }

interface OceanSimState {
  fishBoids: FishBoid[]
  nextCreatureAt: number; creatureIdx: number; creature: CreatureBoid | null
  ghostFish: GhostFish[]
  causticCells: CausticCell[]
  jellyfish: JellyState[]
  bubbles: BubbleState[]
  seahorsePhase: number
  octopusPhase: number; octopusVisible: boolean; octopusTimer: number
  clownPhase: number
}

// ─── Draw: water atmosphere ──────────────────────────────────────────────────
function drawWaterAtmosphere(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
  const grad = ctx.createLinearGradient(0, vh * 0.45, 0, vh)
  grad.addColorStop(0, 'rgba(62,92,185,0)')
  grad.addColorStop(1, 'rgba(42,58,140,0.055)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, vw, vh)
}

// ─── Draw: light rays ────────────────────────────────────────────────────────
function drawLightRays(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number) {
  const prev = ctx.globalAlpha; ctx.globalAlpha = prev * 0.85
  for (let i = 0; i < 5; i++) {
    const x0 = vw * (0.08 + i * 0.21) + Math.sin(t * 0.00024 + i * 0.82) * vw * 0.038
    const w0 = vw * (0.038 + Math.abs(Math.sin(t * 0.00028 + i * 1.17)) * 0.022)
    const dep = vh * (0.48 + Math.abs(Math.sin(i * 0.73)) * 0.40)
    const w1  = w0 * (2.2 + Math.sin(t * 0.00019 + i) * 0.45)
    const grad = ctx.createLinearGradient(x0, 0, x0, dep)
    grad.addColorStop(0, `rgba(255,228,160,${0.048 + Math.sin(t * 0.00038 + i) * 0.010})`)
    grad.addColorStop(1, 'rgba(255,228,160,0)')
    ctx.beginPath()
    ctx.moveTo(x0 - w0/2, 0); ctx.lineTo(x0 + w0/2, 0)
    ctx.lineTo(x0 + w1/2, dep); ctx.lineTo(x0 - w1/2, dep)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
  }
  ctx.globalAlpha = prev
}

// ─── Draw: caustics (offscreen) ──────────────────────────────────────────────
function drawCausticsOffscreen(
  ctx: CanvasRenderingContext2D, cells: CausticCell[], t: number, w: number, h: number,
) {
  ctx.clearRect(0, 0, w, h)
  for (const c of cells) {
    const phase = c.phase + t * 0.00062
    ctx.beginPath()
    for (let i = 0; i <= 7; i++) {
      const ang = (i / 7) * Math.PI * 2
      const wob = 1 + Math.sin(phase + i * 1.13) * 0.40
      const px = c.cx * w + Math.cos(ang) * c.r * w * wob
      const py = c.cy * h + Math.sin(ang) * c.r * h * wob * 0.55
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(255,210,110,${(0.026 + Math.sin(phase * 0.52) * 0.007).toFixed(4)})`
    ctx.fill()
  }
}

// ─── Draw: ghost fish ────────────────────────────────────────────────────────
function drawGhostFish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, phase: number) {
  const u = Math.sin(phase) * 0.07
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  ctx.beginPath()
  ctx.ellipse(0, u * sz * 0.3, sz * 1.08, sz * 0.38, u * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-sz * 0.98, u * sz * 0.3)
  ctx.lineTo(-sz * 1.52, -sz * 0.26)
  ctx.lineTo(-sz * 1.28,  u * sz * 0.3)
  ctx.lineTo(-sz * 1.52,  sz * 0.26)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

// ─── Draw: jellyfish ─────────────────────────────────────────────────────────
function drawJellyfish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, t: number) {
  const pulse = 1 + Math.sin(t * 0.0018) * 0.10
  const bw = sz * pulse, bh = sz * 1.05 * pulse
  ctx.save(); ctx.translate(x, y)
  // Bell dome
  ctx.beginPath()
  ctx.moveTo(-bw, 0)
  ctx.bezierCurveTo(-bw * 1.05, -bh * 0.82, -bw * 0.6, -bh * 1.32, 0, -bh * 1.30)
  ctx.bezierCurveTo(bw * 0.6, -bh * 1.32, bw * 1.05, -bh * 0.82, bw, 0)
  // Scalloped edge (5 lobes)
  const segW = (bw * 2) / 5
  for (let i = 4; i >= 0; i--) {
    const mx = -bw + (i + 0.5) * segW, x0 = -bw + i * segW, x1 = -bw + (i + 1) * segW
    ctx.bezierCurveTo(x1, sz * 0.05, mx, sz * 0.26 * pulse, mx, sz * 0.17 * pulse)
    ctx.bezierCurveTo(mx, sz * 0.26 * pulse, x0, sz * 0.05, x0, 0)
  }
  ctx.closePath()
  ctx.fillStyle = Lv(0.06); ctx.fill()
  ctx.strokeStyle = I(0.24); ctx.lineWidth = 0.70; ctx.stroke()
  // Radial canals
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI + (i / 5) * Math.PI + Math.PI / 10
    ctx.beginPath(); ctx.moveTo(0, -bh * 0.12)
    ctx.lineTo(Math.cos(ang) * bw * 0.86, Math.sin(ang) * bh * 0.86)
    ctx.strokeStyle = I(0.07); ctx.lineWidth = 0.35; ctx.stroke()
  }
  // Circular canal
  ctx.beginPath(); ctx.arc(0, -bh * 0.08, bw * 0.72, Math.PI, 0)
  ctx.strokeStyle = I(0.08); ctx.lineWidth = 0.35; ctx.stroke()
  // Oral arms (4)
  for (let i = 0; i < 4; i++) {
    const ox = (i - 1.5) * sz * 0.30
    const len = sz * (1.65 + Math.sin(t * 0.0012 + i * 0.5) * 0.30)
    const wv = Math.sin(t * 0.0009 + i * 0.9) * sz * 0.32
    ctx.beginPath()
    ctx.moveTo(ox, sz * 0.10)
    ctx.bezierCurveTo(ox + wv, sz * 0.55, ox - wv * 0.55, sz * 1.05, ox + wv * 0.22, sz * 0.10 + len)
    ctx.strokeStyle = Lv(0.30); ctx.lineWidth = 0.55; ctx.stroke()
  }
  // Marginal tentacles (10)
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI + (i / 9) * Math.PI
    const bx = Math.cos(ang) * bw * 0.90, by = Math.sin(ang) * bh * 0.85
    if (by < -bh * 0.08) continue
    const wv2 = Math.sin(t * 0.001 + i * 0.78) * sz * 0.15
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + wv2, by + sz * (0.55 + Math.abs(Math.sin(i * 1.2)) * 0.55))
    ctx.strokeStyle = Lv(0.22); ctx.lineWidth = 0.35; ctx.stroke()
  }
  ctx.restore()
}

// ─── Draw: seahorse ──────────────────────────────────────────────────────────
function drawSeahorse(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, t: number) {
  ctx.save(); ctx.translate(x, y)
  // Coronet spikes
  for (let i = 0; i < 5; i++) {
    const cx = (i - 2) * sz * 0.09
    const ch = sz * (0.10 + Math.abs(Math.sin(i * 1.4)) * 0.09)
    ctx.beginPath()
    ctx.moveTo(cx, -sz * 1.02); ctx.lineTo(cx + sz * 0.04, -sz * 1.02 - ch)
    ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.72; ctx.stroke()
  }
  // Head
  ctx.beginPath()
  ctx.ellipse(sz * 0.08, -sz * 0.88, sz * 0.24, sz * 0.18, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = F(115, 148, 165, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.40); ctx.lineWidth = 0.85; ctx.stroke()
  // Snout
  ctx.beginPath()
  ctx.moveTo(sz * 0.22, -sz * 0.90)
  ctx.lineTo(sz * 0.58, -sz * 0.96)
  ctx.strokeStyle = I(0.40); ctx.lineWidth = sz * 0.11; ctx.lineCap = 'round'; ctx.stroke()
  ctx.lineCap = 'butt'
  // Body S-curve (fat stroke = the body)
  ctx.beginPath()
  ctx.moveTo(sz * 0.08, -sz * 0.70)
  ctx.bezierCurveTo(sz * 0.46, -sz * 0.48, sz * 0.42, sz * 0.08, sz * 0.26, sz * 0.38)
  ctx.strokeStyle = F(115, 148, 165, 0.55); ctx.lineWidth = sz * 0.28; ctx.lineCap = 'round'; ctx.stroke()
  ctx.strokeStyle = I(0.38); ctx.lineWidth = 0.90; ctx.stroke()
  ctx.lineCap = 'butt'
  // Body ring texture (horizontal dashes)
  for (let i = 0; i < 6; i++) {
    const ry = -sz * 0.60 + i * sz * 0.18
    const rx = sz * 0.25 + Math.sin(i * 0.5) * sz * 0.05
    ctx.beginPath()
    ctx.moveTo(rx - sz * 0.14, ry); ctx.lineTo(rx + sz * 0.14, ry)
    ctx.strokeStyle = I(0.12); ctx.lineWidth = 0.45; ctx.stroke()
  }
  // Dorsal fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.08, -sz * 0.58)
  for (let i = 0; i < 5; i++) {
    const fy = -sz * 0.58 + i * sz * 0.20
    const fx = sz * 0.34 + Math.sin(t * 0.009 + i * 0.6) * sz * 0.10
    ctx.lineTo(fx, fy)
  }
  ctx.lineTo(sz * 0.26, sz * 0.18)
  ctx.strokeStyle = I(0.20); ctx.lineWidth = 0.50; ctx.stroke()
  // Tail curl
  ctx.beginPath()
  ctx.moveTo(sz * 0.20, sz * 0.38)
  ctx.bezierCurveTo(sz * 0.10, sz * 0.55, -sz * 0.15, sz * 0.68, -sz * 0.32, sz * 0.60)
  ctx.bezierCurveTo(-sz * 0.48, sz * 0.52, -sz * 0.50, sz * 0.36, -sz * 0.32, sz * 0.28)
  ctx.strokeStyle = I(0.40); ctx.lineWidth = sz * 0.14; ctx.lineCap = 'round'; ctx.stroke()
  ctx.lineCap = 'butt'
  // Eye
  ctx.beginPath(); ctx.arc(sz * 0.22, -sz * 0.90, sz * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = I(0.62); ctx.fill()
  ctx.restore()
}

// ─── Draw: anemone ────────────────────────────────────────────────────────────
function drawAnemone(ctx: CanvasRenderingContext2D, x: number, baseY: number, sz: number, t: number) {
  ctx.save(); ctx.translate(x, baseY)
  // Column
  ctx.beginPath()
  ctx.moveTo(-sz * 0.36, 0)
  ctx.bezierCurveTo(-sz * 0.42, -sz * 0.5, -sz * 0.40, -sz * 0.82, -sz * 0.28, -sz * 0.96)
  ctx.lineTo(sz * 0.28, -sz * 0.96)
  ctx.bezierCurveTo(sz * 0.40, -sz * 0.82, sz * 0.42, -sz * 0.5, sz * 0.36, 0)
  ctx.closePath()
  ctx.fillStyle = Rs(0.10); ctx.fill()
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.80; ctx.stroke()
  // Tentacles (16, shorter for perf)
  for (let i = 0; i < 14; i++) {
    const ang = (i / 13) * Math.PI * 2
    const r = sz * 0.26
    const tx = Math.cos(ang) * r, ty = -sz * 0.96 + Math.sin(ang) * r * 0.38
    const wv = Math.sin(t * 0.001 + i * 0.65) * sz * 0.16
    const tlen = sz * (0.42 + Math.abs(Math.sin(i * 1.1)) * 0.32)
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.bezierCurveTo(tx + wv, ty - tlen * 0.4, tx - wv * 0.5, ty - tlen * 0.82, tx + wv * 0.2, ty - tlen)
    ctx.strokeStyle = Rs(0.38); ctx.lineWidth = 0.95; ctx.stroke()
    ctx.beginPath(); ctx.arc(tx + wv * 0.2, ty - tlen, sz * 0.042, 0, Math.PI * 2)
    ctx.fillStyle = Rs(0.42); ctx.fill()
  }
  ctx.restore()
}

// ─── Draw: clownfish ─────────────────────────────────────────────────────────
function drawClownfish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, phase: number) {
  const u = Math.sin(phase) * 0.08
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  // Body
  ctx.beginPath()
  ctx.ellipse(0, u * sz * 0.3, sz * 1.02, sz * 0.45, u * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = Or(0.18); ctx.fill()
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 0.72; ctx.stroke()
  // White stripes (3)
  for (const sx of [sz * 0.45, -sz * 0.08, -sz * 0.58]) {
    ctx.beginPath()
    ctx.ellipse(sx, u * sz * 0.22, sz * 0.13, sz * 0.42, u * 0.20, 0, Math.PI * 2)
    ctx.fillStyle = F(242, 238, 224, 0.58); ctx.fill()
    ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.45; ctx.stroke()
  }
  // Round tail
  ctx.beginPath(); ctx.arc(-sz * 1.02, 0, sz * 0.30, 0, Math.PI * 2)
  ctx.fillStyle = Or(0.14); ctx.fill()
  ctx.strokeStyle = I(0.38); ctx.lineWidth = 0.62; ctx.stroke()
  // Dorsal fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.18, -sz * 0.42)
  ctx.bezierCurveTo(-sz * 0.08, -sz * 0.76, -sz * 0.42, -sz * 0.70, -sz * 0.55, -sz * 0.42)
  ctx.strokeStyle = I(0.35); ctx.lineWidth = 0.52; ctx.stroke()
  // Eye
  ctx.beginPath(); ctx.arc(sz * 0.50, -sz * 0.06, sz * 0.11, 0, Math.PI * 2)
  ctx.fillStyle = I(0.65); ctx.fill()
  ctx.restore()
}

// ─── Draw: octopus ───────────────────────────────────────────────────────────
function drawOctopus(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, t: number) {
  const R = sz * (1 + Math.sin(t * 0.0008) * 0.04)
  ctx.save(); ctx.translate(x, y)
  // 8 arms (spread downward)
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI * 0.18) + (i / 7) * (Math.PI * 0.64)
    const len = R * (1.85 + Math.abs(Math.sin(i * 1.1)) * 0.75)
    const cv1 = Math.sin(t * 0.0006 + i * 0.82) * R * 0.55
    const cv2 = Math.sin(t * 0.0005 + i * 1.15) * R * 0.38
    const ex  = Math.cos(ang) * len, ey = Math.sin(ang) * len + R * 0.08
    const bp  = { x: Math.cos(ang) * R * 0.68, y: Math.sin(ang) * R * 0.28 + R * 0.08 }
    ctx.beginPath()
    ctx.moveTo(bp.x, bp.y)
    ctx.bezierCurveTo(bp.x + cv1, bp.y + len * 0.28, ex + cv2, ey - len * 0.3, ex, ey)
    ctx.strokeStyle = I(0.30); ctx.lineWidth = Math.max(0.5, 1.2 - i * 0.06); ctx.lineCap = 'round'; ctx.stroke()
    ctx.lineCap = 'butt'
    // Suckers (3 per arm)
    for (let j = 1; j <= 3; j++) {
      const f = j / 4
      const sx = bp.x + (ex - bp.x) * f, sy = bp.y + (ey - bp.y) * f
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.048, 0, Math.PI * 2)
      ctx.strokeStyle = I(0.16); ctx.lineWidth = 0.38; ctx.stroke()
    }
  }
  // Mantle
  ctx.beginPath()
  ctx.moveTo(0, -R * 1.35)
  ctx.bezierCurveTo(-R * 0.85, -R * 1.0, -R, -R * 0.28, -R * 0.82, R * 0.08)
  ctx.bezierCurveTo(-R * 0.52, R * 0.38, R * 0.52, R * 0.38, R * 0.82, R * 0.08)
  ctx.bezierCurveTo(R, -R * 0.28, R * 0.85, -R * 1.0, 0, -R * 1.35)
  ctx.closePath()
  ctx.fillStyle = F(165, 118, 82, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 1.0; ctx.stroke()
  // Eyes
  for (const ex of [-R * 0.28, R * 0.28]) {
    ctx.beginPath(); ctx.arc(ex, -R * 0.52, R * 0.14, 0, Math.PI * 2)
    ctx.fillStyle = F(248, 242, 228, 0.9); ctx.fill()
    ctx.strokeStyle = I(0.38); ctx.lineWidth = 0.72; ctx.stroke()
    ctx.beginPath(); ctx.arc(ex, -R * 0.52, R * 0.08, 0, Math.PI * 2)
    ctx.fillStyle = I(0.70); ctx.fill()
  }
  ctx.restore()
}

// ─── Draw: seaweed ────────────────────────────────────────────────────────────
function drawSeaweed(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, t: number) {
  ctx.save(); ctx.translate(x, baseY)
  let cx = 0, cy = 0
  const segs = 6
  for (let i = 0; i < segs; i++) {
    const segH = h / segs
    const wv = Math.sin(t * 0.0008 + i * 0.92) * 7 * (i / segs)
    const nx = cx + wv, ny = cy - segH
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.bezierCurveTo(cx + wv * 0.4, cy - segH * 0.32, nx - wv * 0.28, ny + segH * 0.32, nx, ny)
    ctx.strokeStyle = Gr(0.38); ctx.lineWidth = 1.5 - i * 0.12; ctx.lineCap = 'round'; ctx.stroke()
    ctx.lineCap = 'butt'
    if (i > 0 && i < segs - 1) {
      const side = i % 2 === 0 ? 1 : -1
      ctx.beginPath(); ctx.moveTo(nx, ny)
      ctx.bezierCurveTo(nx + side * 5, ny - 3, nx + side * 11, ny - 5, nx + side * 12, ny - 8)
      ctx.strokeStyle = Gr(0.28); ctx.lineWidth = 0.70; ctx.stroke()
    }
    cx = nx; cy = ny
  }
  ctx.restore()
}

// ─── Draw: bubble ────────────────────────────────────────────────────────────
function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  const prev = ctx.globalAlpha; ctx.globalAlpha = prev * alpha
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.50; ctx.stroke()
  ctx.beginPath(); ctx.arc(x - r * 0.30, y - r * 0.30, r * 0.28, 0, Math.PI * 2)
  ctx.strokeStyle = I(0.12); ctx.lineWidth = 0.38; ctx.stroke()
  ctx.globalAlpha = prev
}

// ─── Draw: manta ray ─────────────────────────────────────────────────────────
function drawMantaRay(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  const flap = Math.sin(lt * 0.00060) * 0.08
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  // Right wing
  ctx.beginPath()
  ctx.moveTo(sz * 0.14, sz * 0.04)
  ctx.bezierCurveTo(sz * 0.35, sz * (0.14 + flap * 2.5), sz * 0.66, sz * (0.24 + flap * 3.5), sz * 0.92, sz * (0.10 + flap * 2.8))
  ctx.bezierCurveTo(sz * 0.74, -sz * 0.04, sz * 0.44, sz * 0.02, sz * 0.14, sz * 0.04)
  ctx.closePath(); ctx.fillStyle = F(62, 72, 110, 0.07); ctx.fill(); ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.95; ctx.stroke()
  // Left wing
  ctx.beginPath()
  ctx.moveTo(sz * 0.14, -sz * 0.04)
  ctx.bezierCurveTo(sz * 0.35, -sz * (0.14 + flap * 2.5), sz * 0.66, -sz * (0.24 + flap * 3.5), sz * 0.92, -sz * (0.10 + flap * 2.8))
  ctx.bezierCurveTo(sz * 0.74, sz * 0.04, sz * 0.44, -sz * 0.02, sz * 0.14, -sz * 0.04)
  ctx.closePath(); ctx.fillStyle = F(62, 72, 110, 0.07); ctx.fill(); ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.95; ctx.stroke()
  // Body disc
  ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.18, sz * 0.12, 0, 0, Math.PI * 2)
  ctx.fillStyle = F(62, 72, 110, 0.09); ctx.fill(); ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke()
  // Cephalic fins
  ctx.beginPath(); ctx.moveTo(sz * 0.14, sz * 0.05); ctx.bezierCurveTo(sz * 0.30, sz * 0.04, sz * 0.40, sz * 0.01, sz * 0.42, -sz * 0.04)
  ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.85; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz * 0.14, -sz * 0.05); ctx.bezierCurveTo(sz * 0.30, -sz * 0.04, sz * 0.40, -sz * 0.01, sz * 0.42, sz * 0.04)
  ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.85; ctx.stroke()
  // Tail
  ctx.beginPath(); ctx.moveTo(-sz * 0.14, sz * 0.01)
  ctx.bezierCurveTo(-sz * 0.42, sz * (0.05 + flap * 0.5), -sz * 0.75, -sz * 0.02, -sz * 1.15, sz * (0.07 + flap * 0.3))
  ctx.bezierCurveTo(-sz * 1.50, sz * 0.04, -sz * 1.80, sz * 0.02, -sz * 2.10, 0)
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.85; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'
  // Eye
  ctx.beginPath(); ctx.arc(sz * 0.18, sz * 0.07, sz * 0.025, 0, Math.PI * 2)
  ctx.fillStyle = I(0.55); ctx.fill()
  ctx.restore()
}

// ─── Draw: sea turtle ────────────────────────────────────────────────────────
function drawSeaTurtle(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  const fp = Math.sin(lt * 0.0010) * 0.18
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  // Shell
  ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.10, sz * 0.85, 0, 0, Math.PI * 2)
  ctx.fillStyle = F(82, 110, 72, 0.09); ctx.fill(); ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.15; ctx.stroke()
  // Central scute hexagon
  ctx.beginPath()
  ctx.moveTo(sz * 0.50, 0); ctx.lineTo(sz * 0.22, sz * 0.22); ctx.lineTo(-sz * 0.22, sz * 0.22)
  ctx.lineTo(-sz * 0.50, 0); ctx.lineTo(-sz * 0.22, -sz * 0.22); ctx.lineTo(sz * 0.22, -sz * 0.22); ctx.closePath()
  ctx.strokeStyle = I(0.16); ctx.lineWidth = 0.52; ctx.stroke()
  // Costal scute lines (3 per side)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(sz * (0.20 - i * 0.22), s * sz * 0.22)
      ctx.lineTo(sz * (0.28 - i * 0.28), s * sz * 0.58)
      ctx.strokeStyle = I(0.12); ctx.lineWidth = 0.42; ctx.stroke()
    }
  }
  // Head
  ctx.beginPath(); ctx.ellipse(sz * 1.18, 0, sz * 0.36, sz * 0.26, 0, 0, Math.PI * 2)
  ctx.fillStyle = F(82, 110, 72, 0.09); ctx.fill(); ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.95; ctx.stroke()
  ctx.beginPath(); ctx.arc(sz * 1.32, -sz * 0.10, sz * 0.065, 0, Math.PI * 2); ctx.fillStyle = I(0.58); ctx.fill()
  // Front flippers (animated)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sz * 0.38, s * sz * 0.60)
    ctx.bezierCurveTo(sz * 0.72, s * sz * (0.82 + fp * s * 0.6), sz * 1.12, s * sz * (0.72 + fp * s), sz * 1.42, s * sz * (0.46 + fp * s * 0.8))
    ctx.bezierCurveTo(sz * 1.10, s * sz * 0.34, sz * 0.70, s * sz * 0.48, sz * 0.38, s * sz * 0.60)
    ctx.closePath(); ctx.fillStyle = F(82, 110, 72, 0.07); ctx.fill(); ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.85; ctx.stroke()
  }
  // Rear flippers
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-sz * 0.48, s * sz * 0.55)
    ctx.bezierCurveTo(-sz * 0.72, s * sz * 0.72, -sz * 1.10, s * sz * 0.65, -sz * 1.22, s * sz * 0.42)
    ctx.bezierCurveTo(-sz * 1.0, s * sz * 0.32, -sz * 0.72, s * sz * 0.38, -sz * 0.48, s * sz * 0.55)
    ctx.closePath(); ctx.fillStyle = F(82, 110, 72, 0.06); ctx.fill(); ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.80; ctx.stroke()
  }
  ctx.restore()
}

// ─── Draw: stingray ──────────────────────────────────────────────────────────
function drawStingray(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  const wv = Math.sin(lt * 0.0012) * 0.08
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  // Body disc (kite shape)
  ctx.beginPath()
  ctx.moveTo(sz * 0.85, 0)
  ctx.bezierCurveTo(sz * 0.60, -sz * (0.36 + wv * 0.5), sz * 0.10, -sz * (0.46 + wv), -sz * 0.35, -sz * (0.28 + wv * 0.7))
  ctx.lineTo(-sz * 0.50, 0)
  ctx.bezierCurveTo(sz * 0.10, sz * (0.46 + wv), sz * 0.60, sz * (0.36 + wv * 0.5), sz * 0.85, 0)
  ctx.closePath()
  ctx.fillStyle = F(115, 100, 80, 0.08); ctx.fill(); ctx.strokeStyle = I(0.34); ctx.lineWidth = 0.95; ctx.stroke()
  // Dorsal spots
  for (let i = 0; i < 7; i++) {
    ctx.beginPath(); ctx.arc(sz * (0.48 - i * 0.12), (Math.abs(i % 3 - 1) - 0.5) * sz * 0.16, sz * 0.028, 0, Math.PI * 2)
    ctx.fillStyle = I(0.14); ctx.fill()
  }
  // Tail
  ctx.beginPath(); ctx.moveTo(-sz * 0.50, 0)
  ctx.bezierCurveTo(-sz * 0.90, sz * (0.08 + wv * 0.4), -sz * 1.45, -sz * 0.05, -sz * 2.00, sz * (0.10 + wv * 0.3))
  ctx.bezierCurveTo(-sz * 2.40, sz * 0.07, -sz * 2.70, sz * 0.03, -sz * 3.00, 0)
  ctx.strokeStyle = I(0.33); ctx.lineWidth = 0.78; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'
  // Venomous spine
  ctx.beginPath(); ctx.moveTo(-sz * 0.72, 0); ctx.lineTo(-sz * 0.72, -sz * 0.14)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.95; ctx.stroke()
  // Eyes
  for (const ey of [-sz * 0.10, sz * 0.10]) {
    ctx.beginPath(); ctx.arc(sz * 0.60, ey, sz * 0.050, 0, Math.PI * 2); ctx.fillStyle = I(0.54); ctx.fill()
  }
  ctx.restore()
}

// ─── Draw: pufferfish ────────────────────────────────────────────────────────
function drawPufferfish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, inflated: boolean, lt: number) {
  const inflation = inflated ? Math.min(1.60, 1 + (lt / 600) * 0.60) : 1
  const R = sz * inflation
  const spLen = sz * 0.28 * inflation
  ctx.save(); ctx.translate(x, y)
  // Body
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fillStyle = F(188, 168, 108, 0.10); ctx.fill(); ctx.strokeStyle = I(0.38); ctx.lineWidth = 0.95; ctx.stroke()
  // Spines (18)
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(ang) * R, Math.sin(ang) * R)
    ctx.lineTo(Math.cos(ang) * (R + spLen), Math.sin(ang) * (R + spLen))
    ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.55; ctx.stroke()
    ctx.beginPath(); ctx.arc(Math.cos(ang) * (R + spLen), Math.sin(ang) * (R + spLen), 0.9, 0, Math.PI * 2)
    ctx.fillStyle = I(0.22); ctx.fill()
  }
  // Eyes
  ctx.beginPath(); ctx.arc(R * 0.42, -R * 0.28, R * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = F(248, 242, 228, 0.92); ctx.fill(); ctx.strokeStyle = I(0.42); ctx.lineWidth = 0.85; ctx.stroke()
  ctx.beginPath(); ctx.arc(R * 0.46, -R * 0.30, R * 0.12, 0, Math.PI * 2); ctx.fillStyle = I(0.72); ctx.fill()
  // Beak mouth
  ctx.beginPath(); ctx.moveTo(R * 0.66, R * 0.04); ctx.lineTo(R * 0.92, R * 0.04)
  ctx.strokeStyle = I(0.30); ctx.lineWidth = 0.62; ctx.stroke()
  if (!inflated) {
    // Pectoral fin flutter
    const finA = Math.sin(lt * 0.006) * 0.12
    ctx.beginPath(); ctx.moveTo(R * 0.10, R * 0.34)
    ctx.bezierCurveTo(R * 0.40, R * (0.48 + finA), R * 0.64, R * 0.38, R * 0.58, R * 0.18)
    ctx.strokeStyle = I(0.24); ctx.lineWidth = 0.65; ctx.stroke()
  }
  ctx.restore()
}

// ─── Draw: anglerfish ────────────────────────────────────────────────────────
function drawAnglerfish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  const lurePulse = 0.5 + 0.5 * Math.sin(lt * 0.0022)
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  // Body
  ctx.beginPath()
  ctx.moveTo(sz * 1.40, 0)
  ctx.bezierCurveTo(sz * 1.50, -sz * 0.52, sz * 0.80, -sz * 0.72, -sz * 0.40, -sz * 0.36)
  ctx.bezierCurveTo(-sz * 0.85, -sz * 0.14, -sz * 0.90, sz * 0.10, -sz * 0.65, sz * 0.28)
  ctx.bezierCurveTo(sz * 0.00, sz * 0.60, sz * 0.85, sz * 0.54, sz * 1.35, sz * 0.22)
  ctx.closePath(); ctx.fillStyle = F(35, 38, 52, 0.12); ctx.fill(); ctx.strokeStyle = I(0.50); ctx.lineWidth = 1.25; ctx.stroke()
  // Fang teeth
  for (let i = 0; i < 5; i++) {
    const tx = sz * (1.35 - i * 0.18), th = sz * (0.13 + Math.abs(Math.sin(i * 1.7)) * 0.09)
    ctx.beginPath(); ctx.moveTo(tx - sz * 0.04, sz * 0.04); ctx.lineTo(tx, sz * 0.04 + th); ctx.lineTo(tx + sz * 0.04, sz * 0.04)
    ctx.fillStyle = I(0.52); ctx.fill()
  }
  // Lower jaw
  ctx.beginPath(); ctx.moveTo(sz * 1.40, 0); ctx.bezierCurveTo(sz * 1.50, sz * 0.20, sz * 1.20, sz * 0.34, sz * 0.80, sz * 0.30)
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.88; ctx.stroke()
  // Eye (tiny — characteristic)
  ctx.beginPath(); ctx.arc(sz * 0.95, -sz * 0.40, sz * 0.10, 0, Math.PI * 2); ctx.fillStyle = I(0.65); ctx.fill()
  // Illicium (lure stalk)
  const lwv = Math.sin(lt * 0.0015) * sz * 0.22
  ctx.beginPath(); ctx.moveTo(sz * 0.58, -sz * 0.68)
  ctx.bezierCurveTo(sz * 0.60, -sz * 1.12, sz * 0.72 + lwv, -sz * 1.52, sz * 0.72 + lwv * 1.5, -sz * 1.82)
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.68; ctx.stroke()
  // Esca (glowing lure tip)
  const er = sz * 0.10 * (1 + lurePulse * 0.28)
  ctx.beginPath(); ctx.arc(sz * 0.72 + lwv * 1.5, -sz * 1.82, er, 0, Math.PI * 2)
  ctx.fillStyle = F(110, 240, 175, 0.55 * lurePulse); ctx.fill()
  ctx.beginPath(); ctx.arc(sz * 0.72 + lwv * 1.5, -sz * 1.82, sz * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = F(200, 255, 220, 0.88 * lurePulse); ctx.fill()
  ctx.restore()
}

// ─── Draw: coral fan (unchanged) ─────────────────────────────────────────────
function drawCoralFan(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, flip: boolean) {
  const s = flip ? -1 : 1
  ctx.save(); ctx.translate(x, baseY)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.ellipse(i * 9 * s + s * 3, 3, 7 + Math.abs(i) * 2, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = F(200, 190, 170, 0.18); ctx.fill()
    ctx.strokeStyle = I(0.13); ctx.lineWidth = 0.55; ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(s * 4, -h * 0.22, s * 2, -h * 0.48, s * 1, -h * 0.62)
  ctx.strokeStyle = F(155, 65, 45, 0.42); ctx.lineWidth = 2.0; ctx.stroke()
  const N = 11
  for (let i = 0; i < N; i++) {
    const tt = i / (N - 1)
    const ba = -Math.PI / 2 + (tt - 0.5) * Math.PI * 0.68 * s
    const len = h * (0.55 + 0.42 * Math.sin(tt * Math.PI))
    const sx  = s * 1 + Math.sin(tt * Math.PI) * s * 8
    const sy  = -h * 0.62 - Math.sin(tt * Math.PI) * 4
    const ex  = sx + Math.cos(ba) * len, ey = sy + Math.sin(ba) * len
    const cx1 = sx + Math.cos(ba) * len * 0.4 + s * Math.sin(i) * 5
    const cy1 = sy + Math.sin(ba) * len * 0.4
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx1, cy1, ex, ey)
    ctx.strokeStyle = F(155, 65, 45, 0.14 + Math.sin(tt * Math.PI) * 0.14)
    ctx.lineWidth = 0.52 + Math.sin(tt * Math.PI) * 0.42; ctx.stroke()
    ctx.beginPath(); ctx.arc(ex, ey, 0.85, 0, Math.PI * 2)
    ctx.fillStyle = F(155, 65, 45, 0.28); ctx.fill()
    if (i > 0) {
      const pt = (i - 1) / (N - 1), pa = -Math.PI / 2 + (pt - 0.5) * Math.PI * 0.68 * s
      const pl = h * (0.55 + 0.42 * Math.sin(pt * Math.PI))
      const psx = s * 1 + Math.sin(pt * Math.PI) * s * 8, psy = -h * 0.62 - Math.sin(pt * Math.PI) * 4
      for (let j = 1; j <= 3; j++) {
        const ff = j / 4
        ctx.beginPath()
        ctx.moveTo(sx + Math.cos(ba) * len * ff, sy + Math.sin(ba) * len * ff)
        ctx.lineTo(psx + Math.cos(pa) * pl * ff, psy + Math.sin(pa) * pl * ff)
        ctx.strokeStyle = F(155, 65, 45, 0.08); ctx.lineWidth = 0.32; ctx.stroke()
      }
    }
  }
  ctx.restore()
}

// ─── Draw: fish ───────────────────────────────────────────────────────────────
function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, angle: number, phase: number, depth: number) {
  const io = depth * 0.38 + 0.24, fo = depth * 0.04 + 0.02, u = Math.sin(phase) * 0.10
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(0, u * sz * 0.35, sz * 1.15, sz * 0.42, u * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = F(62, 92, 185, fo); ctx.fill(); ctx.strokeStyle = I(io); ctx.lineWidth = 0.82; ctx.stroke()
  const tr = -sz * 1.05 + u * sz * 0.15
  ctx.beginPath()
  ctx.moveTo(tr, u * sz * 0.35); ctx.lineTo(-sz * 1.72, -sz * 0.26)
  ctx.lineTo(-sz * 1.48, u * sz * 0.35); ctx.lineTo(-sz * 1.72, sz * 0.26)
  ctx.closePath(); ctx.fillStyle = F(62, 92, 185, fo); ctx.fill(); ctx.strokeStyle = I(io * 0.72); ctx.lineWidth = 0.62; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz * 0.04, -sz * 0.42 + u * sz * 0.22); ctx.quadraticCurveTo(-sz * 0.24, -sz * 0.82, -sz * 0.52, -sz * 0.42); ctx.strokeStyle = I(io * 0.62); ctx.lineWidth = 0.58; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz * 0.46, -sz * 0.28); ctx.bezierCurveTo(sz * 0.54, 0, sz * 0.46, sz * 0.28, sz * 0.34, sz * 0.26); ctx.strokeStyle = I(io * 0.52); ctx.lineWidth = 0.52; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz * 0.12, sz * 0.08); ctx.quadraticCurveTo(-sz * 0.08, sz * 0.48, -sz * 0.38, sz * 0.26); ctx.strokeStyle = I(io * 0.44); ctx.lineWidth = 0.52; ctx.stroke()
  if (sz >= 5) {
    ctx.save(); ctx.setLineDash([sz * 0.09, sz * 0.11]); ctx.beginPath()
    ctx.moveTo(sz * 0.34, -sz * 0.03); ctx.lineTo(-sz * 0.90, -sz * 0.03)
    ctx.strokeStyle = I(io * 0.38); ctx.lineWidth = 0.48; ctx.stroke(); ctx.setLineDash([]); ctx.restore()
  }
  ctx.beginPath(); ctx.arc(sz * 0.57, -sz * 0.04, sz * 0.10, 0, Math.PI * 2)
  ctx.fillStyle = I(Math.min(io * 1.3, 0.70)); ctx.fill(); ctx.restore()
}

// ─── Draw: whale ─────────────────────────────────────────────────────────────
function drawWhale(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  const fluke = Math.sin(lt * 0.00085) * 0.20
  ctx.beginPath(); ctx.moveTo(-sz*2.2, 0); ctx.bezierCurveTo(-sz*1.3,-sz*0.52,sz*0.3,-sz*0.58,sz*1.85,-sz*0.22); ctx.bezierCurveTo(sz*2.18,-sz*0.06,sz*2.1,sz*0.18,sz*1.65,sz*0.38); ctx.bezierCurveTo(sz*0.2,sz*0.60,-sz*1.1,sz*0.52,-sz*2.2,0); ctx.closePath()
  ctx.fillStyle = F(210,200,178,0.09); ctx.fill(); ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.35; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*1.85,-sz*0.18); ctx.bezierCurveTo(sz*2.05,-sz*0.04,sz*2.15,sz*0.10,sz*2.0,sz*0.22); ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.88; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*0.55,sz*0.28); ctx.bezierCurveTo(sz*0.15,sz*0.95,-sz*0.65,sz*1.58,-sz*1.05,sz*1.42); ctx.bezierCurveTo(-sz*0.58,sz*1.08,sz*0.18,sz*0.68,sz*0.55,sz*0.28); ctx.closePath()
  ctx.fillStyle = F(210,200,178,0.10); ctx.fill(); ctx.strokeStyle = I(0.38); ctx.lineWidth = 1.0; ctx.stroke()
  ctx.save(); ctx.translate(-sz*2.2,0); ctx.rotate(fluke)
  ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(-sz*0.48,-sz*0.28,-sz*0.82,-sz*0.82,-sz*0.60,-sz*1.04); ctx.bezierCurveTo(-sz*0.22,-sz*0.58,-sz*0.06,-sz*0.24,0,0); ctx.bezierCurveTo(-sz*0.06,sz*0.24,-sz*0.22,sz*0.58,-sz*0.60,sz*1.04); ctx.bezierCurveTo(-sz*0.82,sz*0.82,-sz*0.48,sz*0.28,0,0); ctx.closePath()
  ctx.fillStyle = F(210,200,178,0.08); ctx.fill(); ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.15; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-sz*0.14,0); ctx.lineTo(-sz*0.35,sz*0.07); ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.72; ctx.stroke(); ctx.restore()
  for (let i = 0; i < 6; i++) { const px = sz*(0.5-i*0.42); ctx.beginPath(); ctx.moveTo(px+sz*0.08,sz*0.32); ctx.lineTo(px-sz*0.04,sz*0.48); ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.52; ctx.stroke() }
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-sz*0.7+i*sz*0.32,-sz*0.44+Math.sin(i*1.8)*sz*0.07,sz*0.038,0,Math.PI*2); ctx.fillStyle = I(0.16); ctx.fill() }
  ctx.beginPath(); ctx.arc(sz*1.38,-sz*0.26,sz*0.092,0,Math.PI*2); ctx.fillStyle = I(0.55); ctx.fill()
  ctx.restore()
}

// ─── Draw: shark ─────────────────────────────────────────────────────────────
function drawShark(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  const tailOsc = Math.sin(lt * 0.0018) * 0.09
  ctx.beginPath(); ctx.moveTo(sz*2.05,0); ctx.bezierCurveTo(sz*1.55,-sz*0.30,sz*0.35,-sz*0.42,-sz*1.25,-sz*0.14); ctx.bezierCurveTo(-sz*1.85,-sz*0.04,-sz*1.95,sz*0.10,-sz*1.65,sz*0.22); ctx.bezierCurveTo(-sz*0.52,sz*0.40,sz*1.05,sz*0.32,sz*1.90,sz*0.16); ctx.bezierCurveTo(sz*2.02,sz*0.07,sz*2.05,0,sz*2.05,0); ctx.closePath()
  ctx.fillStyle = F(185,182,188,0.09); ctx.fill(); ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.20; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*0.28,-sz*0.38); ctx.bezierCurveTo(sz*0.32,-sz*0.92,sz*0.52,-sz*1.10,sz*0.78,-sz*0.38); ctx.closePath(); ctx.fillStyle = F(185,182,188,0.08); ctx.fill(); ctx.strokeStyle = I(0.44); ctx.lineWidth = 1.10; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*0.82,sz*0.10); ctx.bezierCurveTo(sz*0.50,sz*0.55,sz*0.08,sz*0.72,-sz*0.22,sz*0.58); ctx.bezierCurveTo(sz*0.08,sz*0.36,sz*0.60,sz*0.22,sz*0.82,sz*0.10); ctx.closePath(); ctx.fillStyle = F(185,182,188,0.08); ctx.fill(); ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.90; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-sz*0.82,-sz*0.16); ctx.lineTo(-sz*0.72,-sz*0.44); ctx.lineTo(-sz*0.56,-sz*0.16); ctx.closePath(); ctx.fillStyle = F(185,182,188,0.06); ctx.fill(); ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.82; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-sz*0.95,sz*0.22); ctx.lineTo(-sz*0.88,sz*0.48); ctx.lineTo(-sz*0.72,sz*0.22); ctx.closePath(); ctx.fillStyle = F(185,182,188,0.06); ctx.fill(); ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.72; ctx.stroke()
  ctx.save(); ctx.translate(-sz*1.72,0); ctx.rotate(tailOsc)
  ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(-sz*2.05,-sz*0.22,-sz*2.52,-sz*0.58,-sz*2.32,-sz*0.80); ctx.bezierCurveTo(-sz*2.10,-sz*0.52,-sz*1.90,-sz*0.22,0,0); ctx.moveTo(0,0); ctx.bezierCurveTo(-sz*0.22,sz*0.20,-sz*0.45,sz*0.38,-sz*0.30,sz*0.50); ctx.bezierCurveTo(-sz*0.08,sz*0.32,0,sz*0.16,0,0); ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.05; ctx.stroke(); ctx.restore()
  ctx.beginPath(); ctx.moveTo(sz*1.65,sz*0.10); ctx.bezierCurveTo(sz*0.50,sz*0.24,-sz*0.85,sz*0.28,-sz*1.55,sz*0.14); ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.62; ctx.stroke()
  for (let g = 0; g < 5; g++) { const gx = sz*(1.04-g*0.15); ctx.beginPath(); ctx.moveTo(gx,-sz*0.09); ctx.bezierCurveTo(gx+sz*0.035,0,gx+sz*0.035,0,gx,sz*0.11); ctx.strokeStyle = I(0.22); ctx.lineWidth = 0.62; ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(sz*1.72,sz*0.08); ctx.bezierCurveTo(sz*1.60,sz*0.20,sz*1.44,sz*0.22,sz*1.28,sz*0.16); ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.76; ctx.stroke()
  ctx.beginPath(); ctx.arc(sz*1.48,-sz*0.13,sz*0.092,0,Math.PI*2); ctx.fillStyle = I(0.68); ctx.fill()
  ctx.beginPath(); ctx.arc(sz*1.50,-sz*0.155,sz*0.038,0,Math.PI*2); ctx.fillStyle = F(210,205,190,0.45); ctx.fill()
  ctx.restore()
}

// ─── Draw: dolphin ────────────────────────────────────────────────────────────
function drawDolphin(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, dir: 1|-1, lt: number, bodyAngle: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(bodyAngle * dir); ctx.scale(dir, 1)
  const tail = Math.sin(lt * 0.0022) * 0.14
  ctx.beginPath(); ctx.moveTo(sz*1.75,0); ctx.bezierCurveTo(sz*1.22,-sz*0.27,sz*0.32,-sz*0.40,-sz*1.28,-sz*0.06); ctx.bezierCurveTo(-sz*1.80,0,-sz*1.75,sz*0.16,-sz*1.20,sz*0.32); ctx.bezierCurveTo(sz*0.00,sz*0.44,sz*1.10,sz*0.28,sz*1.65,sz*0.13); ctx.bezierCurveTo(sz*1.78,sz*0.06,sz*1.78,0,sz*1.75,0); ctx.closePath()
  ctx.fillStyle = F(165,182,200,0.10); ctx.fill(); ctx.strokeStyle = I(0.47); ctx.lineWidth = 1.10; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*1.12,-sz*0.28); ctx.bezierCurveTo(sz*1.32,-sz*0.46,sz*1.52,-sz*0.42,sz*1.58,-sz*0.22); ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.78; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*1.35,-sz*0.14); ctx.lineTo(sz*1.68,sz*0.05); ctx.strokeStyle = I(0.18); ctx.lineWidth = 0.62; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*0.16,-sz*0.38); ctx.bezierCurveTo(sz*0.26,-sz*0.86,sz*0.62,-sz*0.84,sz*0.66,-sz*0.38); ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sz*0.72,sz*0.09); ctx.bezierCurveTo(sz*0.42,sz*0.52,sz*0.06,sz*0.64,-sz*0.20,sz*0.54); ctx.bezierCurveTo(sz*0.06,sz*0.34,sz*0.52,sz*0.20,sz*0.72,sz*0.09); ctx.closePath(); ctx.fillStyle = F(165,182,200,0.10); ctx.fill(); ctx.strokeStyle = I(0.34); ctx.lineWidth = 0.88; ctx.stroke()
  ctx.save(); ctx.translate(-sz*1.62,0); ctx.rotate(tail)
  ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(-sz*0.32,-sz*0.18,-sz*0.56,-sz*0.55,-sz*0.40,-sz*0.78); ctx.bezierCurveTo(-sz*0.15,-sz*0.50,-sz*0.05,-sz*0.20,0,0); ctx.bezierCurveTo(-sz*0.05,sz*0.20,-sz*0.15,sz*0.50,-sz*0.40,sz*0.78); ctx.bezierCurveTo(-sz*0.56,sz*0.55,-sz*0.32,sz*0.18,0,0); ctx.closePath(); ctx.fillStyle = F(165,182,200,0.09); ctx.fill(); ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke(); ctx.restore()
  ctx.beginPath(); ctx.arc(sz*1.12,-sz*0.18,sz*0.088,0,Math.PI*2); ctx.fillStyle = I(0.58); ctx.fill()
  ctx.beginPath(); ctx.arc(sz*1.14,-sz*0.205,sz*0.038,0,Math.PI*2); ctx.fillStyle = F(225,218,200,0.48); ctx.fill()
  ctx.beginPath(); ctx.moveTo(sz*1.42,sz*0.02); ctx.bezierCurveTo(sz*1.34,sz*0.11,sz*1.24,sz*0.13,sz*1.14,sz*0.10); ctx.strokeStyle = I(0.20); ctx.lineWidth = 0.66; ctx.stroke()
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OceanWorld() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const causticRef  = useRef<HTMLCanvasElement | null>(null)
  const causticCtxR = useRef<CanvasRenderingContext2D | null>(null)
  const causticTick = useRef(0)
  const rafRef      = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let vw = 0, vh = 0

    function resize() {
      vw = window.innerWidth; vh = window.innerHeight
      canvas!.width = vw; canvas!.height = vh
      const cc = document.createElement('canvas')
      cc.width = Math.max(1, Math.round(vw / 2)); cc.height = Math.max(1, Math.round(vh / 2))
      causticRef.current = cc; causticCtxR.current = cc.getContext('2d')
    }
    resize(); window.addEventListener('resize', resize)

    let startMs = 0, lastMs = 0

    const ω1 = Math.PI * 2 / 82000, ω2 = Math.PI * 2 / 63000

    // Fish boids
    const fishBoids: FishBoid[] = SCHOOL.map(f => ({
      pos: { x: vw * 0.5 + f.ox, y: vh * 0.58 + f.oy }, vel: { x: 0, y: 0 }, acc: { x: 0, y: 0 }, mass: 1,
      maxSpeed: 0.06, maxForce: 0.0004, sz: f.sz, depth: f.depth, phase: f.phase * Math.PI, wanderTheta: f.phase * Math.PI,
    }))

    // Ghost fish (positions use live vw/vh)
    const ghostFish: GhostFish[] = GHOST_SEEDS.map(s => ({
      x: s.xFrac * vw, y: s.yFrac * vh, sz: s.sz, speed: s.speed, dir: s.dir, phase: s.phase, zLayer: s.zLayer,
    }))

    // Caustic cells
    const causticCells: CausticCell[] = CAUSTIC_SEEDS.map(s => ({
      cx: s.xFrac, cy: s.yFrac,
      vx: s.vxSign * (0.00004 + Math.abs(Math.sin(s.phase)) * 0.00006),
      vy: s.vySign * (0.00003 + Math.abs(Math.sin(s.phase * 1.3)) * 0.00004),
      r: s.rFrac, phase: s.phase,
    }))

    // Jellyfish
    const jellyfish: JellyState[] = JELLY_SEEDS.map(s => ({
      x: s.xFrac * vw, y: s.yFrac * vh, sz: s.sz, phase: s.phase, driftDir: s.driftDir, zLayer: s.zLayer,
    }))

    // Bubbles — will be spawned dynamically from 3 sources
    const bubbles: BubbleState[] = []
    const BUBBLE_SOURCES = [0.22, 0.50, 0.78]  // x fractions
    let bubbleTimer = 0

    const sim: OceanSimState = {
      fishBoids, ghostFish, causticCells, jellyfish, bubbles,
      nextCreatureAt: 3500, creatureIdx: 0, creature: null,
      seahorsePhase: 0,
      octopusPhase: 0, octopusVisible: true, octopusTimer: 18000,
      clownPhase: 0,
    }

    function spawnCreature(t: number): CreatureBoid {
      const type = CREATURES[sim.creatureIdx % CREATURES.length]
      const dir: 1|-1 = sim.creatureIdx % 2 === 0 ? 1 : -1
      const d = SPAWNDEF[type]
      const initState = type === 'whale' ? 'cruise' : type === 'shark' ? 'patrol' : type === 'dolphin' ? 'arc' : 'traverse'
      return {
        type, dir,
        pos: { x: dir === 1 ? -d.sz * d.spawnMult : vw + d.sz * d.spawnMult, y: vh * d.yFrac },
        vel: { x: d.speed * dir, y: 0 }, acc: { x: 0, y: 0 }, mass: 1,
        maxSpeed: d.maxSpd, maxForce: 0.001,
        sz: d.sz, spawnTime: t, lt: 0,
        state: initState,
        stateTimer: type === 'whale' ? 12000 + Math.random() * 8000 : 0,
        bodyAngle: 0, wanderTheta: 0, lastBreachAt: -999999, inflated: false,
      }
    }

    function frame(now: number) {
      if (!startMs) startMs = now
      const dt = Math.min(now - lastMs, 50); lastMs = now
      const t  = now - startMs

      // School anchor
      const scx = vw * 0.5 + Math.cos(t * ω1) * vw * 0.21
      const scy = vh * 0.58 + Math.sin(t * ω2) * vh * 0.11
      const sdx = -vw * 0.21 * ω1 * Math.sin(t * ω1)
      const sdy =  vh * 0.11 * ω2 * Math.cos(t * ω2)
      const schoolAngle = Math.atan2(sdy, sdx)

      const sharkStalking = sim.creature?.type === 'shark' && sim.creature.state === 'stalk'
      const sharkPos = sharkStalking ? sim.creature!.pos : null

      // Fish boids
      const cosA = Math.cos(schoolAngle), sinA = Math.sin(schoolAngle)
      for (let i = 0; i < sim.fishBoids.length; i++) {
        const boid = sim.fishBoids[i]
        const others = sim.fishBoids.filter((_, j) => j !== i)
        const fT: Vec2 = {
          x: scx + SCHOOL[i].ox * cosA - SCHOOL[i].oy * sinA,
          y: scy + SCHOOL[i].ox * sinA + SCHOOL[i].oy * cosA,
        }
        boid.acc = v2.add(boid.acc, v2.add(
          v2.scale(separate(boid, others, 55, 1.4), 1.2),
          v2.add(v2.scale(align(boid, others, 90), 0.5),
            v2.add(v2.scale(cohere(boid, others, 90), 0.4),
              v2.add(v2.scale(seek(boid, fT, true), 0.9),
                sharkPos ? v2.scale(flee(boid, sharkPos, 350), 2.0) : { x: 0, y: 0 })))))
        step(boid, dt, 0.92); boid.phase += dt * 0.0055
      }

      // Sequential creature
      if (!sim.creature && t >= sim.nextCreatureAt) sim.creature = spawnCreature(t)
      if (sim.creature) {
        const c = sim.creature; c.lt += dt
        const d = SPAWNDEF[c.type]

        if (c.type === 'whale') {
          c.wanderTheta += (Math.random() - 0.5) * 0.25
          if (c.state === 'cruise') {
            c.acc = v2.add(c.acc, v2.add(wander(c, c.wanderTheta, 40), v2.scale(seek(c, { x: c.pos.x + c.vel.x * 500, y: vh * d.yFrac }, false), 0.3)))
            c.stateTimer -= dt; if (c.stateTimer <= 0) { c.state = 'dive_down'; c.stateTimer = 8000 }
          } else if (c.state === 'dive_down') {
            c.acc = v2.add(c.acc, seek(c, { x: c.pos.x + c.vel.x * 800, y: vh * 0.85 }, true))
            c.stateTimer -= dt; if (c.stateTimer <= 0) { c.state = 'dive_up'; c.stateTimer = 8000 }
          } else {
            c.acc = v2.add(c.acc, seek(c, { x: c.pos.x + c.vel.x * 800, y: vh * d.yFrac }, true))
            c.stateTimer -= dt; if (c.stateTimer <= 0) { c.state = 'cruise'; c.stateTimer = 12000 + Math.random() * 8000 }
          }
          step(c, dt, d.drag)

        } else if (c.type === 'shark') {
          const patrolY = vh * d.yFrac, distS = v2.dist(c.pos, { x: scx, y: scy })
          if (c.state === 'patrol') { c.vel.x = d.speed * c.dir; c.acc.y += (patrolY - c.pos.y) * 0.00002; if (distS < 350) { c.state = 'stalk'; c.stateTimer = 8000 } }
          else if (c.state === 'stalk') { c.acc = v2.add(c.acc, seek(c, { x: scx, y: scy }, false)); c.stateTimer -= dt; if (c.stateTimer <= 0 || distS < 80) c.state = 'retreat' }
          else { c.vel.x = d.speed * c.dir * 1.4; c.acc.y += (patrolY - c.pos.y) * 0.00008; if (Math.abs(c.pos.y - patrolY) < 10) c.state = 'patrol' }
          step(c, dt, d.drag)

        } else if (c.type === 'dolphin') {
          const baseY = vh * d.yFrac
          if (c.state === 'arc') {
            c.acc = v2.add(c.acc, seek(c, { x: c.pos.x + c.vel.x * 300, y: baseY + Math.sin(c.lt * 0.00175) * vh * 0.055 }, false))
            if (c.pos.y < vh * 0.22 && c.vel.y < -0.01 && c.lt - c.lastBreachAt > 15000) { c.state = 'breach'; c.stateTimer = 400 }
          } else if (c.state === 'breach') { c.acc.y -= 0.003; c.stateTimer -= dt; if (c.stateTimer <= 0) { c.state = 'arc_return'; c.lastBreachAt = c.lt } }
          else { c.acc = v2.add(c.acc, seek(c, { x: c.pos.x + c.vel.x * 400, y: baseY }, true)); if (Math.abs(c.pos.y - baseY) < 20 && Math.abs(c.vel.y) < 0.02) c.state = 'arc' }
          c.bodyAngle = Math.atan2(c.vel.y, Math.abs(c.vel.x)) * 0.22
          step(c, dt, d.drag)

        } else if (c.type === 'manta') {
          // Manta: gentle sinusoidal vertical glide
          const targetY = vh * d.yFrac + Math.sin(c.lt * 0.00055) * vh * 0.065
          c.acc = v2.add(c.acc, v2.scale(seek(c, { x: c.pos.x + c.vel.x * 600, y: targetY }, false), 0.6))
          step(c, dt, d.drag)

        } else if (c.type === 'turtle') {
          // Turtle: plodding straight with gentle depth variation
          c.vel.x = d.speed * c.dir * (0.88 + Math.sin(c.lt * 0.0008) * 0.12)
          const targetY = vh * d.yFrac + Math.sin(c.lt * 0.0006) * vh * 0.04
          c.acc.y += (targetY - c.pos.y) * 0.00004
          step(c, dt, d.drag)

        } else if (c.type === 'stingray') {
          // Stingray: hugs the bottom with slight vertical undulation
          const targetY = vh * d.yFrac + Math.sin(c.lt * 0.0010) * vh * 0.028
          c.vel.x = d.speed * c.dir
          c.acc.y += (targetY - c.pos.y) * 0.00006
          step(c, dt, d.drag)

        } else if (c.type === 'pufferfish') {
          // Pufferfish: slow wander, inflate when near school center
          c.wanderTheta += (Math.random() - 0.5) * 0.20
          const distS = v2.dist(c.pos, { x: scx, y: scy })
          c.inflated = distS < 200
          c.acc = v2.add(c.acc, v2.scale(wander(c, c.wanderTheta, 30), 0.6))
          const targetY = vh * d.yFrac + Math.sin(c.lt * 0.0012) * vh * 0.03
          c.acc.y += (targetY - c.pos.y) * 0.00004
          c.vel.x += d.speed * c.dir * 0.02
          step(c, dt, d.drag)

        } else {
          // Anglerfish: slow deep traverse with slight vertical weave
          c.vel.x = d.speed * c.dir * (0.85 + Math.sin(c.lt * 0.0007) * 0.15)
          const targetY = vh * d.yFrac + Math.sin(c.lt * 0.00075) * vh * 0.038
          c.acc.y += (targetY - c.pos.y) * 0.00003
          step(c, dt, d.drag)
        }

        const margin = d.sz * 3.5
        if (c.dir === 1 ? c.pos.x > vw + margin : c.pos.x < -margin) {
          sim.creature = null; sim.creatureIdx++; sim.nextCreatureAt = t + 8000 + Math.random() * 4000
        }
      }

      // Ghost fish
      for (const g of sim.ghostFish) {
        g.phase += dt * 0.004
        g.x += g.speed * g.dir * dSpeed(g.zLayer) * dt
        if (g.dir === 1 && g.x > vw + g.sz * 3) g.x = -g.sz * 3
        if (g.dir === -1 && g.x < -g.sz * 3) g.x = vw + g.sz * 3
      }

      // Jellyfish — slow vertical bob + horizontal drift
      for (const j of sim.jellyfish) {
        j.phase += dt * 0.00085
        j.x += j.driftDir * 0.012 * dSpeed(j.zLayer) * dt
        if (j.x < -j.sz * 2) j.x = vw + j.sz; if (j.x > vw + j.sz * 2) j.x = -j.sz
        // Vertical: bob around initial y (stored as baseY via yFrac at init)
      }

      // Seahorse — slow hover drift
      sim.seahorsePhase += dt * 0.0009

      // Octopus — periodic visibility
      sim.octopusPhase += dt * 0.0007
      sim.octopusTimer -= dt
      if (sim.octopusTimer <= 0) {
        sim.octopusVisible = !sim.octopusVisible
        sim.octopusTimer = sim.octopusVisible ? 22000 + Math.random() * 12000 : 8000 + Math.random() * 6000
      }

      // Clownfish orbit
      sim.clownPhase += dt * 0.0018

      // Bubbles — spawn from 3 sources
      bubbleTimer += dt
      if (bubbleTimer > 800 + Math.random() * 400) {
        bubbleTimer = 0
        const src = BUBBLE_SOURCES[Math.floor(Math.random() * 3)]
        sim.bubbles.push({ x: src * vw + (Math.random() - 0.5) * 30, y: vh * 0.92, r: 2 + Math.random() * 4, speed: 0.025 + Math.random() * 0.020, wobble: Math.random() * Math.PI * 2, life: 1.0 })
      }
      for (let i = sim.bubbles.length - 1; i >= 0; i--) {
        const b = sim.bubbles[i]
        b.y -= b.speed * dt; b.wobble += dt * 0.003; b.x += Math.sin(b.wobble) * 0.4
        b.life = Math.min(1, b.y / (vh * 0.3))  // fade as it rises
        if (b.y < -b.r * 2) sim.bubbles.splice(i, 1)
      }

      // Caustic cells drift
      for (const c of sim.causticCells) {
        c.cx += c.vx * dt; c.cy += c.vy * dt
        if (c.cx < 0 || c.cx > 1) c.vx = -c.vx
        if (c.cy < 0 || c.cy > 0.65) c.vy = -c.vy
      }

      // Offscreen caustic (every 4th frame)
      causticTick.current++
      const cc = causticRef.current, cctx = causticCtxR.current
      if (cctx && cc && causticTick.current % 4 === 0) drawCausticsOffscreen(cctx, sim.causticCells, t, cc.width, cc.height)

      // ─── DRAW ───────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, vw, vh)

      // 1 — Water atmosphere
      drawWaterAtmosphere(ctx, vw, vh)

      // 2 — Light rays
      drawLightRays(ctx, vw, vh, t)

      // 3 — Ghost school (deepest, faintest)
      ctx.save(); ctx.fillStyle = I(0.50)
      for (const g of sim.ghostFish) {
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(g.zLayer)
        drawGhostFish(ctx, g.x, g.y, g.sz * dScale(g.zLayer), g.dir, g.phase); ctx.globalAlpha = prev
      }
      ctx.restore()

      // 4 — Background seaweed (z≈0.38)
      {
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(0.38)
        const sw = Math.min(vh * 0.16, 105)
        drawSeaweed(ctx, vw * 0.14, vh * 0.96, sw, t)
        drawSeaweed(ctx, vw * 0.28, vh * 0.96, sw * 0.75, t)
        drawSeaweed(ctx, vw * 0.72, vh * 0.96, sw * 0.88, t)
        drawSeaweed(ctx, vw * 0.86, vh * 0.96, sw * 0.68, t)
        ctx.globalAlpha = prev
      }

      // 5 — Coral (mid-ground, z≈0.55) + foreground seaweed (z≈0.72)
      {
        const coralH = Math.min(vh * 0.13, 88)
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(0.55)
        drawCoralFan(ctx, vw * 0.055, vh * 0.94, coralH, false)
        drawCoralFan(ctx, vw * 0.945, vh * 0.94, coralH, true)
        drawCoralFan(ctx, vw * 0.50,  vh * 0.96, coralH * 0.72, false)
        // Extra fans flanking center
        drawCoralFan(ctx, vw * 0.32, vh * 0.95, coralH * 0.58, true)
        drawCoralFan(ctx, vw * 0.68, vh * 0.95, coralH * 0.62, false)
        ctx.globalAlpha = prev
        // Closer seaweed (z≈0.72)
        ctx.globalAlpha = prev * dAlpha(0.72)
        const sw2 = Math.min(vh * 0.11, 72)
        drawSeaweed(ctx, vw * 0.20, vh * 0.97, sw2, t)
        drawSeaweed(ctx, vw * 0.42, vh * 0.97, sw2 * 0.80, t)
        drawSeaweed(ctx, vw * 0.58, vh * 0.97, sw2 * 0.90, t)
        drawSeaweed(ctx, vw * 0.80, vh * 0.97, sw2 * 0.75, t)
        ctx.globalAlpha = prev
      }

      // 6 — Jellyfish (various depths)
      for (const j of sim.jellyfish) {
        const bobY = j.y + Math.sin(j.phase) * vh * 0.038
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(j.zLayer)
        drawJellyfish(ctx, j.x, bobY, j.sz * dScale(j.zLayer), t); ctx.globalAlpha = prev
      }

      // 7 — Fish school (z=0.68)
      {
        const z = 0.68, prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(z)
        for (const f of [...sim.fishBoids].sort((a, b) => a.depth - b.depth)) {
          const angle = v2.magnitude(f.vel) > 0.001 ? Math.atan2(f.vel.y, f.vel.x) : schoolAngle
          drawFish(ctx, f.pos.x, f.pos.y, f.sz * dScale(z), angle, f.phase, f.depth)
        }
        ctx.globalAlpha = prev
      }

      // 8 — Sequential visitor (anglerfish draws deep/faint; others mid-to-near)
      if (sim.creature) {
        const c = sim.creature
        const z = SPAWNDEF[c.type].zLayer
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(z)
        const sz = SPAWNDEF[c.type].sz * dScale(z)
        if      (c.type === 'whale')      drawWhale(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else if (c.type === 'shark')      drawShark(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else if (c.type === 'manta')      drawMantaRay(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else if (c.type === 'turtle')     drawSeaTurtle(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else if (c.type === 'stingray')   drawStingray(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else if (c.type === 'pufferfish') drawPufferfish(ctx, c.pos.x, c.pos.y, sz, c.inflated, c.lt)
        else if (c.type === 'anglerfish') drawAnglerfish(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt)
        else {
          // dolphin pod
          drawDolphin(ctx, c.pos.x, c.pos.y, sz, c.dir, c.lt, c.bodyAngle)
          const p2 = ctx.globalAlpha; ctx.globalAlpha = p2 * 0.82
          drawDolphin(ctx, c.pos.x - c.dir * 50, c.pos.y - 52 * dScale(z), sz * 0.88, c.dir, c.lt + 500, c.bodyAngle * 0.7)
          drawDolphin(ctx, c.pos.x - c.dir * 88, c.pos.y + 40 * dScale(z), sz * 0.92, c.dir, c.lt + 800, c.bodyAngle * 0.6)
          ctx.globalAlpha = p2
        }
        ctx.globalAlpha = prev
      }

      // 9 — Seahorse (z=0.90, near bottom-left coral)
      {
        const z = 0.90, prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(z)
        const shX = vw * 0.088 + Math.sin(sim.seahorsePhase * 0.72) * 16
        const shY = vh * 0.82 + Math.sin(sim.seahorsePhase) * 11
        drawSeahorse(ctx, shX, shY, 20 * dScale(z), t)
        ctx.globalAlpha = prev
      }

      // 10 — Anemone + clownfish (z=0.92, bottom-right)
      {
        const z = 0.92, prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(z)
        const anX = vw * 0.888, anY = vh * 0.90
        const anSz = 26 * dScale(z)
        drawAnemone(ctx, anX, anY, anSz, t)
        // Two clownfish orbiting anemone
        for (let i = 0; i < 2; i++) {
          const orbitR = anSz * 1.1, orbitAng = sim.clownPhase + i * Math.PI
          const cfx = anX + Math.cos(orbitAng) * orbitR
          const cfy = anY - anSz * 0.96 + Math.sin(orbitAng) * orbitR * 0.42
          const dir: 1|-1 = Math.cos(orbitAng) > 0 ? 1 : -1
          drawClownfish(ctx, cfx, cfy, 8 * dScale(z), dir, sim.clownPhase + i * 1.5)
        }
        ctx.globalAlpha = prev
      }

      // 11 — Octopus (z=0.96, bottom-center, periodic)
      if (sim.octopusVisible) {
        const z = 0.96, prev = ctx.globalAlpha
        const emergeAmt = Math.min(1, (22000 - sim.octopusTimer) / 3000)
        ctx.globalAlpha = prev * dAlpha(z) * emergeAmt
        const ocX = vw * 0.48 + Math.sin(sim.octopusPhase * 0.5) * vw * 0.04
        const ocY = vh * 0.92 - Math.sin(sim.octopusPhase * 0.3) * vh * 0.018
        drawOctopus(ctx, ocX, ocY, 30 * dScale(z), t)
        ctx.globalAlpha = prev
      }

      // 12 — Bubbles (foreground z≈0.95)
      {
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * dAlpha(0.95)
        for (const b of sim.bubbles) drawBubble(ctx, b.x, b.y, b.r, b.life)
        ctx.globalAlpha = prev
      }

      // 13 — Anglerfish deep-water overlay: subtle darkness when it's present
      if (sim.creature?.type === 'anglerfish') {
        const fade = Math.min(1, sim.creature.lt / 4000)   // fade in over 4s
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * fade * 0.09
        ctx.fillStyle = 'rgba(18,22,40,1)'; ctx.fillRect(0, 0, vw, vh)
        ctx.globalAlpha = prev
      }

      // 15 — Caustics overlay
      if (cc) {
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * 0.88
        ctx.drawImage(cc, 0, 0, vw, vh); ctx.globalAlpha = prev
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 6 }} />
  )
}
