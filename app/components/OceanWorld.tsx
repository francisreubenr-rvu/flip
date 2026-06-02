'use client'
import { useRef, useEffect } from 'react'

// ─── Deterministic fish formation offsets ─────────────────────────────────────
// ox/oy: position within school's local frame (forward × perpendicular)
const SCHOOL = Array.from({ length: 8 }, (_, i) => ({
  ox:    Math.sin(i * 2.81 + 0.5) * 68 + Math.cos(i * 1.41) * 32,
  oy:    Math.sin(i * 1.93 + 1.2) * 28 + Math.cos(i * 3.07) * 14,
  phase: i * 0.73 + 0.31,
  sz:    9 + Math.abs(Math.sin(i * 1.27)) * 4.5,
}))

const CREATURES = ['whale', 'shark', 'dolphin'] as const
type Creature = typeof CREATURES[number]

interface CreatureState {
  type: Creature
  x: number
  y: number
  dir: 1 | -1
  speed: number  // px/ms
}

interface OceanState {
  nextCreatureAt: number  // t (ms) when next creature spawns
  creatureIdx: number
  creature: CreatureState | null
  fishPhase: number
}

// ─── INK helpers (pen-and-ink field guide palette) ────────────────────────────
const I  = (a: number)                         => `rgba(30,37,53,${a})`
const F  = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`

// ─── Fish ─────────────────────────────────────────────────────────────────────
function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, angle: number, phase: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  const u = Math.sin(phase) * 0.12  // subtle body bend

  // Body
  ctx.beginPath()
  ctx.ellipse(0, u * sz * 0.5, sz * 1.15, sz * 0.42, u, 0, Math.PI * 2)
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 0.85
  ctx.fillStyle   = F(62, 92, 185, 0.05)
  ctx.fill(); ctx.stroke()

  // Tail
  ctx.beginPath()
  ctx.moveTo(sz * 1.05, u * sz * 0.5)
  ctx.lineTo(sz * 1.75, -sz * 0.38)
  ctx.lineTo(sz * 1.5,  u * sz * 0.5)
  ctx.lineTo(sz * 1.75,  sz * 0.38)
  ctx.closePath()
  ctx.fillStyle = F(62, 92, 185, 0.04); ctx.fill()
  ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.7; ctx.stroke()

  // Dorsal fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.05, -sz * 0.42 + u * sz * 0.3)
  ctx.quadraticCurveTo(sz * 0.25, -sz * 0.82, sz * 0.52, -sz * 0.42)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.65; ctx.stroke()

  // Pectoral fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.08, sz * 0.08)
  ctx.quadraticCurveTo(sz * 0.12, sz * 0.52, sz * 0.42, sz * 0.28)
  ctx.strokeStyle = I(0.22); ctx.lineWidth = 0.6; ctx.stroke()

  // Eye
  ctx.beginPath()
  ctx.arc(-sz * 0.58, -sz * 0.04, sz * 0.095, 0, Math.PI * 2)
  ctx.fillStyle = I(0.52); ctx.fill()

  ctx.restore()
}

// ─── Coral fan ────────────────────────────────────────────────────────────────
function drawCoralFan(
  ctx: CanvasRenderingContext2D,
  x: number, baseY: number, h: number, flip: boolean,
) {
  const s = flip ? -1 : 1
  ctx.save(); ctx.translate(x, baseY)

  // Base stem
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(s * 4, -h * 0.22, s * 2, -h * 0.48, s * 1, -h * 0.62)
  ctx.lineWidth = 2.2
  ctx.strokeStyle = F(155, 65, 45, 0.38)
  ctx.stroke()

  // Fan branches
  const N = 11
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const baseAngle = -Math.PI / 2 + (t - 0.5) * (Math.PI * 0.68) * s
    const len = h * (0.55 + 0.42 * Math.sin(t * Math.PI))
    const startX = s * 1 + Math.sin(t * Math.PI) * s * 8
    const startY = -h * 0.62 - Math.sin(t * Math.PI) * 4
    const ex = startX + Math.cos(baseAngle) * len
    const ey = startY + Math.sin(baseAngle) * len
    const cx1 = startX + Math.cos(baseAngle) * len * 0.4 + s * Math.sin(i) * 6
    const cy1 = startY + Math.sin(baseAngle) * len * 0.4

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(cx1, cy1, ex, ey)
    const a = 0.14 + Math.sin(t * Math.PI) * 0.14
    ctx.strokeStyle = F(155, 65, 45, a)
    ctx.lineWidth = 0.55 + Math.sin(t * Math.PI) * 0.45
    ctx.stroke()

    // Cross-hatch mesh (characteristic of fan coral)
    if (i > 0) {
      const pt = (i - 1) / (N - 1)
      const prevAngle = -Math.PI / 2 + (pt - 0.5) * (Math.PI * 0.68) * s
      const prevLen = h * (0.55 + 0.42 * Math.sin(pt * Math.PI))
      const psx = s * 1 + Math.sin(pt * Math.PI) * s * 8
      const psy = -h * 0.62 - Math.sin(pt * Math.PI) * 4
      for (let j = 1; j <= 3; j++) {
        const f = j / 4
        const ax = startX + Math.cos(baseAngle) * len * f
        const ay = startY + Math.sin(baseAngle) * len * f
        const bx = psx + Math.cos(prevAngle) * prevLen * f
        const by = psy + Math.sin(prevAngle) * prevLen * f
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        ctx.strokeStyle = F(155, 65, 45, 0.08); ctx.lineWidth = 0.35; ctx.stroke()
      }
    }
  }

  // Small rocks at base
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.ellipse(i * 9 * s + s * 4, 3, 7 + Math.abs(i) * 2, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = F(200, 190, 170, 0.18); ctx.fill()
    ctx.strokeStyle = I(0.14); ctx.lineWidth = 0.6; ctx.stroke()
  }

  ctx.restore()
}

// ─── Whale (humpback) ─────────────────────────────────────────────────────────
function drawWhale(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, dir: 1 | -1, t: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)

  const fluke = Math.sin(t * 0.00085) * 0.07  // slow tail oscillation

  // Main body
  ctx.beginPath()
  ctx.moveTo(-sz * 2.2, 0)
  ctx.bezierCurveTo(-sz * 1.3, -sz * 0.52, sz * 0.3, -sz * 0.58, sz * 1.85, -sz * 0.22)
  ctx.bezierCurveTo(sz * 2.18, -sz * 0.06, sz * 2.1, sz * 0.18, sz * 1.65, sz * 0.38)
  ctx.bezierCurveTo(sz * 0.2, sz * 0.60, -sz * 1.1, sz * 0.52, -sz * 2.2, 0)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.35; ctx.stroke()

  // Rostrum (head detail)
  ctx.beginPath()
  ctx.moveTo(sz * 1.85, -sz * 0.18)
  ctx.bezierCurveTo(sz * 2.05, -sz * 0.04, sz * 2.15, sz * 0.1, sz * 2.0, sz * 0.22)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.9; ctx.stroke()

  // Pectoral fin (long — humpback signature)
  ctx.beginPath()
  ctx.moveTo(sz * 0.55, sz * 0.28)
  ctx.bezierCurveTo(sz * 0.15, sz * 0.95, -sz * 0.65, sz * 1.58, -sz * 1.05, sz * 1.42)
  ctx.bezierCurveTo(-sz * 0.58, sz * 1.08, sz * 0.18, sz * 0.68, sz * 0.55, sz * 0.28)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.38); ctx.lineWidth = 1.0; ctx.stroke()

  // Flukes
  ctx.save(); ctx.translate(-sz * 2.2, 0); ctx.rotate(fluke)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-sz * 0.48, -sz * 0.28, -sz * 0.82, -sz * 0.82, -sz * 0.6, -sz * 1.04)
  ctx.bezierCurveTo(-sz * 0.22, -sz * 0.58, -sz * 0.06, -sz * 0.24, 0, 0)
  ctx.bezierCurveTo(-sz * 0.06, sz * 0.24, -sz * 0.22, sz * 0.58, -sz * 0.6, sz * 1.04)
  ctx.bezierCurveTo(-sz * 0.82, sz * 0.82, -sz * 0.48, sz * 0.28, 0, 0)
  ctx.closePath()
  ctx.fillStyle = F(210, 200, 178, 0.08); ctx.fill()
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.15; ctx.stroke()
  // Median notch
  ctx.beginPath()
  ctx.moveTo(-sz * 0.14, 0); ctx.lineTo(-sz * 0.35, sz * 0.08)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.75; ctx.stroke()
  ctx.restore()

  // Throat pleats (ventral grooves)
  for (let i = 0; i < 6; i++) {
    const px = sz * (0.3 - i * 0.42)
    ctx.beginPath(); ctx.moveTo(px, sz * 0.12); ctx.lineTo(px - sz * 0.04, sz * 0.50)
    ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.55; ctx.stroke()
  }

  // Barnacles (subtle clusters on rostrum ridge)
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
  x: number, y: number, sz: number, dir: 1 | -1, t: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)

  // Body
  ctx.beginPath()
  ctx.moveTo(sz * 2.05, 0)
  ctx.bezierCurveTo(sz * 1.55, -sz * 0.30, sz * 0.35, -sz * 0.42, -sz * 1.25, -sz * 0.14)
  ctx.bezierCurveTo(-sz * 1.85, -sz * 0.04, -sz * 1.95, sz * 0.1, -sz * 1.65, sz * 0.22)
  ctx.bezierCurveTo(-sz * 0.52, sz * 0.40, sz * 1.05, sz * 0.32, sz * 1.9, sz * 0.16)
  ctx.bezierCurveTo(sz * 2.02, sz * 0.07, sz * 2.05, 0, sz * 2.05, 0)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.48); ctx.lineWidth = 1.2; ctx.stroke()

  // Dorsal fin (tall, iconic — the silhouette)
  ctx.beginPath()
  ctx.moveTo(sz * 0.28, -sz * 0.38)
  ctx.bezierCurveTo(sz * 0.32, -sz * 0.92, sz * 0.52, -sz * 1.1, sz * 0.78, -sz * 0.38)
  ctx.strokeStyle = I(0.44); ctx.lineWidth = 1.1; ctx.stroke()

  // Pectoral fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.82, sz * 0.1)
  ctx.bezierCurveTo(sz * 0.5, sz * 0.55, sz * 0.08, sz * 0.72, -sz * 0.22, sz * 0.58)
  ctx.bezierCurveTo(sz * 0.08, sz * 0.36, sz * 0.6, sz * 0.22, sz * 0.82, sz * 0.1)
  ctx.closePath()
  ctx.fillStyle = F(185, 182, 188, 0.09); ctx.fill()
  ctx.strokeStyle = I(0.36); ctx.lineWidth = 0.9; ctx.stroke()

  // Second dorsal (small)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.82, -sz * 0.16); ctx.lineTo(-sz * 0.72, -sz * 0.44); ctx.lineTo(-sz * 0.56, -sz * 0.16)
  ctx.strokeStyle = I(0.32); ctx.lineWidth = 0.85; ctx.stroke()

  // Anal fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.95, sz * 0.22); ctx.lineTo(-sz * 0.88, sz * 0.48); ctx.lineTo(-sz * 0.72, sz * 0.22)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.75; ctx.stroke()

  // Heterocercal tail (upper lobe longer — distinguishing shark feature)
  ctx.beginPath()
  ctx.moveTo(-sz * 1.72, 0)
  ctx.bezierCurveTo(-sz * 2.05, -sz * 0.22, -sz * 2.52, -sz * 0.58, -sz * 2.32, -sz * 0.80)
  ctx.bezierCurveTo(-sz * 2.1, -sz * 0.52, -sz * 1.9, -sz * 0.22, -sz * 1.72, 0)
  ctx.moveTo(-sz * 1.72, 0)
  ctx.bezierCurveTo(-sz * 1.92, sz * 0.2, -sz * 2.15, sz * 0.38, -sz * 2.0, sz * 0.5)
  ctx.bezierCurveTo(-sz * 1.78, sz * 0.32, -sz * 1.72, sz * 0.16, -sz * 1.72, 0)
  ctx.strokeStyle = I(0.42); ctx.lineWidth = 1.05; ctx.stroke()

  // Counter-shading demarcation (lighter ventral side)
  ctx.beginPath()
  ctx.moveTo(sz * 1.65, sz * 0.10)
  ctx.bezierCurveTo(sz * 0.5, sz * 0.24, -sz * 0.85, sz * 0.28, -sz * 1.55, sz * 0.14)
  ctx.strokeStyle = I(0.10); ctx.lineWidth = 0.65; ctx.stroke()

  // Mouth
  ctx.beginPath()
  ctx.moveTo(sz * 1.72, sz * 0.08)
  ctx.bezierCurveTo(sz * 1.6, sz * 0.2, sz * 1.44, sz * 0.22, sz * 1.28, sz * 0.16)
  ctx.strokeStyle = I(0.28); ctx.lineWidth = 0.8; ctx.stroke()

  // Eye (nictitating — cold, black)
  ctx.beginPath(); ctx.arc(sz * 1.48, -sz * 0.13, sz * 0.092, 0, Math.PI * 2)
  ctx.fillStyle = I(0.68); ctx.fill()
  ctx.beginPath(); ctx.arc(sz * 1.50, -sz * 0.155, sz * 0.038, 0, Math.PI * 2)
  ctx.fillStyle = F(210, 205, 190, 0.45); ctx.fill()

  ctx.restore()
}

// ─── Dolphin ──────────────────────────────────────────────────────────────────
function drawDolphin(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number, dir: 1 | -1, t: number, bodyAngle: number,
) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(bodyAngle * dir); ctx.scale(dir, 1)

  const tail = Math.sin(t * 0.0022) * 0.065

  // Body
  ctx.beginPath()
  ctx.moveTo(sz * 1.75, 0)
  ctx.bezierCurveTo(sz * 1.22, -sz * 0.27, sz * 0.32, -sz * 0.40, -sz * 1.28, -sz * 0.06)
  ctx.bezierCurveTo(-sz * 1.80, 0, -sz * 1.75, sz * 0.16, -sz * 1.2, sz * 0.32)
  ctx.bezierCurveTo(sz * 0.0, sz * 0.44, sz * 1.1, sz * 0.28, sz * 1.65, sz * 0.13)
  ctx.bezierCurveTo(sz * 1.78, sz * 0.06, sz * 1.78, 0, sz * 1.75, 0)
  ctx.closePath()
  ctx.fillStyle = F(165, 182, 200, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.47); ctx.lineWidth = 1.1; ctx.stroke()

  // Melon (rounded forehead — dolphin characteristic)
  ctx.beginPath()
  ctx.moveTo(sz * 1.12, -sz * 0.28)
  ctx.bezierCurveTo(sz * 1.32, -sz * 0.46, sz * 1.52, -sz * 0.42, sz * 1.58, -sz * 0.22)
  ctx.strokeStyle = I(0.26); ctx.lineWidth = 0.8; ctx.stroke()

  // Beak demarcation
  ctx.beginPath()
  ctx.moveTo(sz * 1.35, -sz * 0.14); ctx.lineTo(sz * 1.68, sz * 0.05)
  ctx.strokeStyle = I(0.18); ctx.lineWidth = 0.65; ctx.stroke()

  // Dorsal fin (curved, falcate)
  ctx.beginPath()
  ctx.moveTo(sz * 0.16, -sz * 0.38)
  ctx.bezierCurveTo(sz * 0.26, -sz * 0.86, sz * 0.62, -sz * 0.84, sz * 0.66, -sz * 0.38)
  ctx.strokeStyle = I(0.40); ctx.lineWidth = 1.0; ctx.stroke()

  // Pectoral fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.72, sz * 0.09)
  ctx.bezierCurveTo(sz * 0.42, sz * 0.52, sz * 0.06, sz * 0.64, -sz * 0.20, sz * 0.54)
  ctx.bezierCurveTo(sz * 0.06, sz * 0.34, sz * 0.52, sz * 0.20, sz * 0.72, sz * 0.09)
  ctx.closePath()
  ctx.fillStyle = F(165, 182, 200, 0.10); ctx.fill()
  ctx.strokeStyle = I(0.34); ctx.lineWidth = 0.88; ctx.stroke()

  // Crescent tail
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

  // Smile (rostrum line)
  ctx.beginPath()
  ctx.moveTo(sz * 1.42, sz * 0.02)
  ctx.bezierCurveTo(sz * 1.34, sz * 0.11, sz * 1.24, sz * 0.13, sz * 1.14, sz * 0.10)
  ctx.strokeStyle = I(0.20); ctx.lineWidth = 0.68; ctx.stroke()

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
      nextCreatureAt: 4000,
      creatureIdx: 0,
      creature: null,
      fishPhase: 0,
    }

    function spawnCreature(t: number) {
      const type = CREATURES[state.creatureIdx % 3]
      // Alternate direction each creature; deterministic by index
      const dir: 1 | -1 = state.creatureIdx % 2 === 0 ? 1 : -1
      const speeds:   Record<Creature, number> = { whale: 0.044, shark: 0.082, dolphin: 0.068 }
      const yFracs:   Record<Creature, number> = { whale: 0.44,  shark: 0.64,  dolphin: 0.38  }
      const sz:       Record<Creature, number> = { whale: 54,    shark: 38,    dolphin: 30    }
      state.creature = {
        type, dir,
        x:     dir === 1 ? -sz[type] * 2.5 : vw + sz[type] * 2.5,
        y:     vh * yFracs[type],
        speed: speeds[type],
      }
    }

    function frame(now: number) {
      if (!startMs) startMs = now
      const dt = Math.min(now - lastMs, 50); lastMs = now
      const t = now - startMs

      // ── Fish school: slow elliptical drift ──────────────────────────────
      const ω1 = Math.PI * 2 / 82000, ω2 = Math.PI * 2 / 63000
      const scx = vw * 0.5 + Math.cos(t * ω1) * vw * 0.21
      const scy = vh * 0.58 + Math.sin(t * ω2) * vh * 0.11
      const dx  = -vw * 0.21 * ω1 * Math.sin(t * ω1)
      const dy  =  vh * 0.11 * ω2 * Math.cos(t * ω2)
      const schoolAngle = Math.atan2(dy, dx)
      state.fishPhase += dt * 0.0055

      // ── Feature creature lifecycle ───────────────────────────────────────
      if (!state.creature && t >= state.nextCreatureAt) {
        spawnCreature(t)
      }
      if (state.creature) {
        const c = state.creature
        c.x += c.speed * c.dir * dt
        const sz = { whale: 54, shark: 38, dolphin: 30 }[c.type]
        const offscreen = c.dir === 1 ? c.x > vw + sz * 2.8 : c.x < -sz * 2.8
        if (offscreen) {
          state.creature = null
          state.creatureIdx++
          state.nextCreatureAt = t + 9000   // 9s pause between creatures
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, vw, vh)

      // Coral fans — bottom corners
      const coralH = Math.min(vh * 0.13, 90)
      drawCoralFan(ctx, vw * 0.055, vh * 0.94, coralH, false)
      drawCoralFan(ctx, vw * 0.945, vh * 0.94, coralH, true)

      // Fish school
      for (const f of SCHOOL) {
        const cos = Math.cos(schoolAngle), sin = Math.sin(schoolAngle)
        const fx = scx + f.ox * cos - f.oy * sin
        const fy = scy + f.ox * sin + f.oy * cos
        drawFish(ctx, fx, fy, f.sz, schoolAngle, state.fishPhase + f.phase * Math.PI)
      }

      // Feature creature
      if (state.creature) {
        const c = state.creature
        if (c.type === 'whale') {
          drawWhale(ctx, c.x, c.y, 54, c.dir, t)
        } else if (c.type === 'shark') {
          const weave = Math.sin(t * 0.00082) * vh * 0.022
          drawShark(ctx, c.x, c.y + weave, 38, c.dir, t)
        } else {
          // Dolphin arcs gently through the water column
          const arc   = Math.sin(t * 0.00175) * vh * 0.055
          const arcV  = Math.cos(t * 0.00175) * 0.00175 * vh * 0.055
          const tilt  = Math.atan2(arcV, c.speed * 68) * 0.8
          drawDolphin(ctx, c.x, c.y + arc, 30, c.dir, t, tilt)
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
