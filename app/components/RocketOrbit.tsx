'use client'
import { useRef, useEffect } from 'react'
import {
  keplerStep,
  Vec2, Boid, v2, step, separate, seek, flee, arrival, flowField, simplexFlow,
  pathFollow, SpatialHash, containment, leaderFollow, gravityForce,
} from '../lib/physics'

const DEG = Math.PI / 180

// ─── Pre-generated asteroid belt (deterministic, no Math.random at module level) ──
const ASTEROIDS = Array.from({ length: 38 }, (_, i) => ({
  phase:  (i / 38) * Math.PI * 2 + Math.sin(i * 17.3) * 0.28,
  r:      1.7 + (Math.sin(i * 7.1 + 2) + 1) * 1.5,
  spread: Math.sin(i * 13.7) * 0.065,
  sides:  3 + Math.floor(Math.abs(Math.sin(i * 3.7)) * 4),
  rot:    Math.sin(i * 11.1) * Math.PI,
  drift:  0.000015 + Math.abs(Math.sin(i * 5.3)) * 0.000025,
}))

const BELT_FLOW = simplexFlow(0.0018, 0.00014, 0.5)

// Burn intensity passed to drawRocket via module-level variable
let _burnBoost = 0

interface AsteroidBoid extends Boid {
  sides: number; rot: number; rotSpeed: number; r: number
}

interface CometState {
  theta: number; visible: boolean; nextAppearAt: number; tailPts: Vec2[]
}

// ─── Orbit helpers ────────────────────────────────────────────────────────────
function orbitPt(θ: number, cx: number, cy: number, A: number, B: number, tilt: number) {
  const cT = Math.cos(tilt), sT = Math.sin(tilt)
  const ex = A * Math.cos(θ), ey = B * Math.sin(θ)
  return { x: cx + ex * cT - ey * sT, y: cy + ex * sT + ey * cT }
}
function orbitDepth(θ: number) { return Math.sin(θ) }
function orbitScale(θ: number) { return 0.52 + 0.78 * (orbitDepth(θ) + 1) / 2 }
function orbitTangent(θ: number, A: number, B: number, tilt: number) {
  const cT = Math.cos(tilt), sT = Math.sin(tilt)
  const dx = -A * Math.sin(θ) * cT - B * Math.cos(θ) * sT
  const dy = -A * Math.sin(θ) * sT + B * Math.cos(θ) * cT
  return Math.atan2(dy, dx)
}

function beltPath(cx: number, cy: number, A: number, B: number, tilt: number): Vec2[] {
  return Array.from({ length: 36 }, (_, i) => {
    const theta = (i / 36) * Math.PI * 2
    const cT = Math.cos(tilt), sT = Math.sin(tilt)
    const ex = A * Math.cos(theta), ey = B * Math.sin(theta)
    return { x: cx + ex * cT - ey * sT, y: cy + ex * sT + ey * cT }
  })
}

// ─── Drawing: orbit path ──────────────────────────────────────────────────────
function drawOrbitPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, A: number, B: number, tilt: number,
  dash = [4, 9], alpha = 0.09,
) {
  ctx.save()
  ctx.strokeStyle = `rgba(62,92,185,${alpha})`
  ctx.lineWidth = 1; ctx.setLineDash(dash)
  ctx.beginPath()
  for (let i = 0; i <= 360; i++) {
    const { x, y } = orbitPt((i / 360) * Math.PI * 2, cx, cy, A, B, tilt)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath(); ctx.stroke(); ctx.restore()
}

// ─── Drawing: planet ──────────────────────────────────────────────────────────
function drawPlanet(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, sc: number,
  opts: { ring?: boolean; bands?: boolean; moon?: boolean },
) {
  const R = r * sc
  ctx.save(); ctx.translate(x, y)

  // back ring
  if (opts.ring) {
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 2.15, R * 0.44, -15 * DEG, Math.PI, Math.PI * 2)
    ctx.strokeStyle = 'rgba(30,37,53,0.30)'; ctx.lineWidth = R * 0.28; ctx.stroke()
  }

  // planet body
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fillStyle = '#f2ede3'; ctx.fill()
  ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.1 * sc; ctx.stroke()

  // surface bands
  if (opts.bands) {
    ctx.save()
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip()
    for (const yy of [-R * 0.38, R * 0.12, R * 0.5]) {
      ctx.beginPath()
      ctx.ellipse(0, yy, R, R * 0.14, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(30,37,53,0.10)'; ctx.lineWidth = R * 0.22; ctx.stroke()
    }
    ctx.restore()
  }

  // highlight
  ctx.beginPath()
  ctx.arc(-R * 0.30, -R * 0.30, R * 0.52, -2.1, -0.6)
  ctx.strokeStyle = 'rgba(252,248,240,0.55)'; ctx.lineWidth = 0.9 * sc; ctx.stroke()

  // front ring
  if (opts.ring) {
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 2.15, R * 0.44, -15 * DEG, 0, Math.PI)
    ctx.strokeStyle = 'rgba(30,37,53,0.30)'; ctx.lineWidth = R * 0.28; ctx.stroke()
  }

  // moon (small satellite)
  if (opts.moon) {
    const mr = R * 0.28, md = R * 1.9
    ctx.beginPath(); ctx.arc(md, -md * 0.4, mr, 0, Math.PI * 2)
    ctx.fillStyle = '#ede8de'; ctx.fill()
    ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 0.8; ctx.stroke()
  }

  ctx.restore()
}

// ─── Drawing: asteroid ────────────────────────────────────────────────────────
function drawAsteroid(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, sides: number, rot: number, sc: number,
) {
  const rr = r * sc
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2
    const w = 0.62 + Math.abs(Math.sin(i * 2.3 + rot)) * 0.38
    i === 0 ? ctx.moveTo(Math.cos(ang) * rr * w, Math.sin(ang) * rr * w)
            : ctx.lineTo(Math.cos(ang) * rr * w, Math.sin(ang) * rr * w)
  }
  ctx.closePath()
  ctx.fillStyle = '#f0ece4'; ctx.fill()
  ctx.strokeStyle = 'rgba(30,37,53,0.5)'; ctx.lineWidth = 0.75; ctx.stroke()
  ctx.restore()
}

// ─── Drawing: rocket trail ────────────────────────────────────────────────────
function drawTrail(
  ctx: CanvasRenderingContext2D,
  θ: number, cx: number, cy: number, A: number, B: number, tilt: number,
) {
  for (let i = 1; i <= 30; i++) {
    const t = θ - (i / 30) * 0.82
    const { x, y } = orbitPt(t, cx, cy, A, B, tilt)
    const d = orbitDepth(t), sc = orbitScale(t)
    const alpha = (1 - i / 30) * 0.38 * Math.max(0, (d + 1.5) / 2.5)
    ctx.beginPath(); ctx.arc(x, y, sc * 2.0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(62,92,185,${alpha.toFixed(3)})`; ctx.fill()
  }
}

// ─── Drawing: rocket ──────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y,     x + r, y,     r); ctx.closePath()
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, angle: number, now: number) {
  const fl = Math.min(1.0, 0.70 + 0.30 * Math.sin(now * 0.019) + _burnBoost * 0.45)
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2); ctx.scale(sc, sc)

  ctx.save(); ctx.translate(0, 14)
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.bezierCurveTo(-4.5, 5 * fl, -1.5, 11 * fl, 0, 16 * fl)
  ctx.bezierCurveTo(1.5, 11 * fl, 4.5, 5 * fl, 5, 0)
  ctx.closePath(); ctx.fillStyle = `rgba(255,115,15,${(0.85 * fl).toFixed(2)})`; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-2.5, 0)
  ctx.bezierCurveTo(-2, 4 * fl, -0.6, 9 * fl, 0, 12 * fl)
  ctx.bezierCurveTo(0.6, 9 * fl, 2, 4 * fl, 2.5, 0)
  ctx.closePath(); ctx.fillStyle = `rgba(255,225,55,${(0.92 * fl).toFixed(2)})`; ctx.fill()
  ctx.restore()

  rrect(ctx, -7, -14, 14, 28, 4)
  ctx.fillStyle = '#f5f0e8'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-7, -14); ctx.lineTo(0, -26); ctx.lineTo(7, -14)
  ctx.fillStyle = '#f5f0e8'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-14, 16); ctx.lineTo(-7, 14); ctx.closePath()
  ctx.fillStyle = '#f5f0e8'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(7, 4); ctx.lineTo(14, 16); ctx.lineTo(7, 14); ctx.closePath()
  ctx.fillStyle = '#f5f0e8'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.beginPath(); ctx.arc(0, -3, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = '#6878a0'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.arc(-1.3, -4.6, 1.6, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(240,235,228,0.68)'; ctx.fill()

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RocketOrbit() {
  const backRef  = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const rafRef   = useRef(0)
  const θRef     = useRef(0)                    // rocket angle
  const θPRef    = useRef([0.8, 3.5])           // planet angles [inner, outer]
  const θARef    = useRef(0)                    // asteroid belt drift
  const startRef = useRef<number>(0)

  useEffect(() => {
    const back  = backRef.current, front = frontRef.current
    if (!back || !front) return
    const bctx = back.getContext('2d')  as CanvasRenderingContext2D
    const fctx = front.getContext('2d') as CanvasRenderingContext2D
    if (!bctx || !fctx) return

    let cx = 0, cy = 0, vw = 0, vh = 0

    let beltPoints: Vec2[] = []
    const asteroidBoids: AsteroidBoid[] = ASTEROIDS.map((a, i) => ({
      pos: { x: 0, y: 0 }, vel: { x: 0.01, y: 0 },
      acc: { x: 0, y: 0 }, mass: 0.5 + (i % 4) * 0.375,
      maxSpeed: 0.4 + (i % 5) * 0.08, maxForce: 0.003,
      sides: a.sides, rot: a.rot, rotSpeed: a.drift * 30, r: a.r,
    }))
    const moonBoid: Boid = {
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0.05 },
      acc: { x: 0, y: 0 }, mass: 0.3, maxSpeed: 0.12, maxForce: 0.002,
    }
    const cometState: CometState = {
      theta: Math.PI + 0.3, visible: false, nextAppearAt: 45000, tailPts: [],
    }
    let burnIntensity = 0
    let burnTimer = 0
    let scrollPerturb = 0
    let cursorPos: Vec2 | null = null
    let clickTarget: Vec2 | null = null

    function resyncBelt() {
      const bA = vw * 0.29, bB = vh * 0.26, bTilt = -5 * DEG
      beltPoints = beltPath(cx, cy, bA, bB, bTilt)
      asteroidBoids.forEach((a, i) => {
        const idx = Math.round((i / asteroidBoids.length) * beltPoints.length) % beltPoints.length
        a.pos = { ...beltPoints[idx] }
      })
      // Place moon near outer planet start
      moonBoid.pos = { x: cx + vw * 0.44 + 55, y: cy }
    }

    function sync() {
      vw = window.innerWidth; vh = window.innerHeight
      cx = vw / 2; cy = vh / 2
      back!.width  = front!.width  = vw
      back!.height = front!.height = vh
      resyncBelt()
    }
    sync(); window.addEventListener('resize', sync)

    const onScroll = () => { scrollPerturb = Math.min(scrollPerturb + 0.3, 2.0) }
    const onMouseMove = (e: MouseEvent) => { cursorPos = { x: e.clientX, y: e.clientY } }
    const onClick = (e: MouseEvent) => {
      clickTarget = { x: e.clientX, y: e.clientY }
      burnTimer = 800
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('click', onClick)

    // θARef preserved for hook order; no longer advanced (asteroids now driven by Boids)
    void θARef

    let last = 0
    function frame(now: number) {
      if (!startRef.current) startRef.current = now
      const t = (now - startRef.current) * 0.001   // seconds
      const dt = Math.min(now - last, 50); last = now

      // ── Rocket orbit: slowly precessing, near mid-viewport ───────────
      const rocketTilt  = -12 * DEG + Math.sin(t * 0.031) * 0.38 + Math.sin(t * 0.019) * 0.20
      const rocketA     = vw * (0.37 + Math.sin(t * 0.024) * 0.02)
      const rocketB     = vh * (0.34 + Math.cos(t * 0.021) * 0.015)

      // Scroll perturbation on eccentricity
      scrollPerturb *= 0.94
      const rocketEcc = Math.min(0.55, 0.28 + scrollPerturb * 0.04)
      // Burn timer
      if (burnTimer > 0) { burnTimer -= dt; burnIntensity = burnTimer / 800 } else burnIntensity = 0
      _burnBoost = burnIntensity

      // Kepler: speed ∝ (1+e·cosν)² — rocket ~3× faster at periapsis vs apoapsis
      θRef.current     += keplerStep(θRef.current,     rocketEcc, 0.000162,  dt)

      // ── Planet orbits ─────────────────────────────────────────────────
      const innerA = vw * 0.16,  innerB = vh * 0.14,  innerTilt = -22 * DEG
      const outerA = vw * 0.44,  outerB = vh * 0.42,  outerTilt =  14 * DEG
      θPRef.current[0] += keplerStep(θPRef.current[0], 0.12, 0.00042,   dt)
      θPRef.current[1] += keplerStep(θPRef.current[1], 0.08, 0.000038,  dt)

      // ── Asteroid belt ─────────────────────────────────────────────────
      const beltA = vw * 0.29, beltB = vh * 0.26, beltTilt = -5 * DEG
      // (asteroid drift now driven by Boid physics — θARef no longer advanced)

      // Weak mutual gravity coupling between planets (subtle long-period precession)
      const innerPlanetPos = orbitPt(θPRef.current[0], cx, cy, innerA, innerB, innerTilt)
      const outerPlanetPos = orbitPt(θPRef.current[1], cx, cy, outerA, outerB, outerTilt)
      const innerProbe: Boid = {
        pos: innerPlanetPos, vel: { x: 0, y: 0 }, acc: { x: 0, y: 0 },
        mass: 0.8, maxSpeed: 0, maxForce: 0,
      }
      const outerProbe: Boid = {
        pos: outerPlanetPos, vel: { x: 0, y: 0 }, acc: { x: 0, y: 0 },
        mass: 5, maxSpeed: 0, maxForce: 0,
      }
      // Inner planet pulled by outer (tiny perturbation → visible over minutes)
      const gOnInner = gravityForce(innerProbe, outerPlanetPos, 5, 0.8e-5)
      const tangInner = v2.normalize({ x: -innerPlanetPos.y + cy, y: innerPlanetPos.x - cx })
      θPRef.current[0] += v2.dot(gOnInner, tangInner) * 0.00002 * dt
      // Outer planet pulled by inner (even tinier)
      const gOnOuter = gravityForce(outerProbe, innerPlanetPos, 0.8, 0.4e-5)
      const tangOuter = v2.normalize({ x: -outerPlanetPos.y + cy, y: outerPlanetPos.x - cx })
      θPRef.current[1] += v2.dot(gOnOuter, tangOuter) * 0.00001 * dt
      // Rocket gravity from both planets (subtle orbital perturbation)
      const rocketPos = orbitPt(θRef.current, cx, cy, rocketA, rocketB, rocketTilt)
      const rocketProbe: Boid = {
        pos: rocketPos, vel: { x: 0, y: 0 }, acc: { x: 0, y: 0 },
        mass: 0.1, maxSpeed: 0, maxForce: 0,
      }
      const gFromInner = gravityForce(rocketProbe, innerPlanetPos, 0.8, 0.6e-5)
      const gFromOuter = gravityForce(rocketProbe, outerPlanetPos, 5, 0.3e-5)
      const tangRocket = v2.normalize({ x: -rocketPos.y + cy, y: rocketPos.x - cx })
      θRef.current += v2.dot(v2.add(gFromInner, gFromOuter), tangRocket) * 0.000015 * dt

      // Moon orbits outer planet using leaderFollow
      const outerPlanetBoid: Boid = {
        pos: outerPlanetPos, vel: { x: 0, y: 0 },
        acc: { x: 0, y: 0 }, mass: 5, maxSpeed: 0, maxForce: 0,
      }
      moonBoid.acc = v2.add(moonBoid.acc, leaderFollow(moonBoid, outerPlanetBoid, { x: 55, y: 0 }))
      // Tangential orbital push to keep moon in orbit
      const toMoon = v2.sub(moonBoid.pos, outerPlanetPos)
      const tang: Vec2 = v2.normalize({ x: -toMoon.y, y: toMoon.x })
      moonBoid.acc = v2.add(moonBoid.acc, v2.scale(tang, 0.002))
      // Optional arrival assist toward click target if it exists (drains gradually)
      if (clickTarget) {
        moonBoid.acc = v2.add(moonBoid.acc, v2.scale(arrival(moonBoid, clickTarget, 80), 0.0))
      }
      step(moonBoid, dt, 0.97)

      // Asteroid boid updates
      const BELT_BOUNDS = { minX: 0, minY: 0, maxX: vw, maxY: vh }
      for (let ai = 0; ai < asteroidBoids.length; ai++) {
        const a = asteroidBoids[ai]
        if (beltPoints.length > 1) {
          const pf = pathFollow(a, beltPoints, 12, true)
          a.acc = v2.add(a.acc, pf)
        }
        a.acc = v2.add(a.acc, flowField(a, BELT_FLOW, t * 1000, 0.2))
        a.acc = v2.add(a.acc, containment(a, BELT_BOUNDS, 40, 1.0))
        // Separate from nearby asteroids
        const nearAst = asteroidBoids.filter((b, bi) => bi !== ai && v2.distSq(b.pos, a.pos) < 22*22)
        if (nearAst.length > 0) a.acc = v2.add(a.acc, separate(a, nearAst, 18, 1.0))
        // Flee from rocket trail
        if (v2.distSq(a.pos, rocketPos) < 65*65) a.acc = v2.add(a.acc, v2.scale(flee(a, rocketPos, 65), 1.5))
        // Flee from cursor
        if (cursorPos && v2.distSq(a.pos, cursorPos) < 55*55) a.acc = v2.add(a.acc, v2.scale(flee(a, cursorPos, 55), 1.2))
        // Optional seek toward burn click target (gentle, decays with burnIntensity)
        if (clickTarget && burnIntensity > 0.01) {
          a.acc = v2.add(a.acc, v2.scale(seek(a, clickTarget, false), burnIntensity * 0.1))
        }
        step(a, dt, 0.986)
        a.rot += a.rotSpeed * dt * 0.001
      }

      // Comet (eccentric orbit, appears every ~45s)
      const COMET_E = 0.82, COMET_OMEGA = 0.000038
      if (!cometState.visible && t * 1000 >= cometState.nextAppearAt) {
        cometState.visible = true
        cometState.theta = Math.PI * 1.1
        cometState.tailPts = []
      }
      if (cometState.visible) {
        cometState.theta += keplerStep(cometState.theta, COMET_E, COMET_OMEGA, dt) * 0.5
        const cometA = vw * 0.54, cometB = vh * 0.50, cometTilt = 25 * DEG
        const cPos = orbitPt(cometState.theta, cx, cy, cometA, cometB, cometTilt)
        cometState.tailPts.push({ ...cPos })
        if (cometState.tailPts.length > 60) cometState.tailPts.shift()
        if (cometState.theta > Math.PI * 3.2) {
          cometState.visible = false
          cometState.theta = 0
          cometState.tailPts = []
          cometState.nextAppearAt = t * 1000 + 45000 + Math.abs(Math.sin(t * 0.7)) * 25000
        }
      }

      // ── Clear ─────────────────────────────────────────────────────────
      bctx.clearRect(0, 0, vw, vh); fctx.clearRect(0, 0, vw, vh)

      // ── All orbit paths on back ───────────────────────────────────────
      drawOrbitPath(bctx, cx, cy, innerA, innerB, innerTilt, [2, 7], 0.07)
      drawOrbitPath(bctx, cx, cy, rocketA, rocketB, rocketTilt, [4, 9], 0.10)
      drawOrbitPath(bctx, cx, cy, beltA,   beltB,   beltTilt,   [1, 3], 0.06)
      drawOrbitPath(bctx, cx, cy, outerA,  outerB,  outerTilt,  [5, 11], 0.08)

      // ── Asteroids (front canvas, Boid-based) ─────────────────────────
      void beltA; void beltB; void beltTilt
      for (let ai = 0; ai < asteroidBoids.length; ai++) {
        const a = asteroidBoids[ai]
        const theta = Math.atan2(a.pos.y - cy, a.pos.x - cx)
        const sc = orbitScale(theta)
        drawAsteroid(fctx, a.pos.x, a.pos.y, a.r * 0.85, a.sides, a.rot, sc * 0.55)
      }

      // ── Inner planet (back canvas) ────────────────────────────────────
      const ip = θPRef.current[0]
      const iPos = orbitPt(ip, cx, cy, innerA, innerB, innerTilt)
      const iSc  = orbitScale(ip)
      drawPlanet(bctx, iPos.x, iPos.y, 9, iSc, { moon: false, bands: false })

      // ── Outer planet (back canvas, large + ringed + banded) ───────────
      const op = θPRef.current[1]
      const oPos = orbitPt(op, cx, cy, outerA, outerB, outerTilt)
      const oSc  = orbitScale(op)
      drawPlanet(bctx, oPos.x, oPos.y, 22, oSc, { ring: true, bands: true, moon: false })

      // ── Moon (Boid-driven, follows outer planet) ──────────────────────
      {
        const moonSc = orbitScale(Math.atan2(moonBoid.pos.y - cy, moonBoid.pos.x - cx))
        fctx.beginPath()
        fctx.arc(moonBoid.pos.x, moonBoid.pos.y, 4.5 * moonSc, 0, Math.PI * 2)
        fctx.fillStyle = '#ede8de'; fctx.fill()
        fctx.strokeStyle = '#1e2535'; fctx.lineWidth = 0.7; fctx.stroke()
      }

      // ── Comet (front canvas, tail + glow head) ────────────────────────
      if (cometState.visible && cometState.tailPts.length > 1) {
        for (let i = 1; i < cometState.tailPts.length; i++) {
          const pt = cometState.tailPts[i]
          const alpha = (i / cometState.tailPts.length) * 0.5
          const radius = 1.5 * (i / cometState.tailPts.length) + 0.5
          fctx.beginPath(); fctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
          fctx.fillStyle = 'rgba(255,215,100,' + alpha.toFixed(3) + ')'; fctx.fill()
        }
        if (cometState.tailPts.length > 0) {
          const head = cometState.tailPts[cometState.tailPts.length - 1]
          fctx.beginPath(); fctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2)
          fctx.fillStyle = 'rgba(255,240,180,0.92)'; fctx.fill()
          // Subtle glow
          fctx.beginPath(); fctx.arc(head.x, head.y, 8, 0, Math.PI * 2)
          fctx.fillStyle = 'rgba(255,200,80,0.18)'; fctx.fill()
        }
      }

      // ── Rocket trail (back canvas) ────────────────────────────────────
      drawTrail(bctx, θRef.current, cx, cy, rocketA, rocketB, rocketTilt)

      // ── Rocket (back or front depending on depth) ─────────────────────
      const θR  = θRef.current
      const rPos = orbitPt(θR, cx, cy, rocketA, rocketB, rocketTilt)
      const rSc  = orbitScale(θR)
      const rAng = orbitTangent(θR, rocketA, rocketB, rocketTilt)
      const far  = orbitDepth(θR) < 0

      if (far) drawRocket(bctx, rPos.x, rPos.y, rSc, rAng, now)
      else     drawRocket(fctx, rPos.x, rPos.y, rSc, rAng, now)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('click', onClick)
    }
  }, [])

  const cs = (z: number): React.CSSProperties => ({
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    pointerEvents: 'none', zIndex: z,
  })

  return (
    <>
      <canvas ref={backRef}  style={cs(6)}  />
      <canvas ref={frontRef} style={cs(11)} />
    </>
  )
}
