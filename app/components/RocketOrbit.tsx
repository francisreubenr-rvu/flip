'use client'
import { useRef, useEffect } from 'react'

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
  const fl = 0.70 + 0.30 * Math.sin(now * 0.019)
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

    function sync() {
      vw = window.innerWidth; vh = window.innerHeight
      cx = vw / 2; cy = vh / 2
      back!.width  = front!.width  = vw
      back!.height = front!.height = vh
    }
    sync(); window.addEventListener('resize', sync)

    let last = 0
    function frame(now: number) {
      if (!startRef.current) startRef.current = now
      const t = (now - startRef.current) * 0.001   // seconds
      const dt = Math.min(now - last, 50); last = now

      // ── Rocket orbit: slowly precessing ──────────────────────────────
      const rocketTilt  = -12 * DEG + Math.sin(t * 0.031) * 0.38 + Math.sin(t * 0.019) * 0.20
      const rocketA     = Math.min(vw * (0.38 + Math.sin(t * 0.024) * 0.04), 570)
      const rocketB     = Math.min(vh * (0.21 + Math.cos(t * 0.021) * 0.025), 215)
      θRef.current     += 0.000162 * dt

      // ── Planet orbits ─────────────────────────────────────────────────
      const innerA = Math.min(vw * 0.155, 220), innerB = Math.min(vh * 0.088, 82),  innerTilt = -22 * DEG
      const outerA = Math.min(vw * 0.70,  800), outerB = Math.min(vh * 0.34,  220), outerTilt =  14 * DEG
      θPRef.current[0] += 0.00042 * dt  // inner planet: fast
      θPRef.current[1] += 0.000038 * dt // outer planet: slow

      // ── Asteroid belt ─────────────────────────────────────────────────
      const beltA = Math.min(vw * 0.535, 640), beltB = Math.min(vh * 0.27, 175), beltTilt = -5 * DEG
      θARef.current += 0.000022 * dt

      // ── Clear ─────────────────────────────────────────────────────────
      bctx.clearRect(0, 0, vw, vh); fctx.clearRect(0, 0, vw, vh)

      // ── All orbit paths on back ───────────────────────────────────────
      drawOrbitPath(bctx, cx, cy, innerA, innerB, innerTilt, [2, 7], 0.07)
      drawOrbitPath(bctx, cx, cy, rocketA, rocketB, rocketTilt, [4, 9], 0.10)
      drawOrbitPath(bctx, cx, cy, beltA,   beltB,   beltTilt,   [1, 3], 0.06)
      drawOrbitPath(bctx, cx, cy, outerA,  outerB,  outerTilt,  [5, 11], 0.08)

      // ── Asteroids (back canvas) ───────────────────────────────────────
      for (const a of ASTEROIDS) {
        const phase = a.phase + θARef.current + a.drift * (now - startRef.current)
        const bA = beltA * (1 + a.spread), bB = beltB * (1 + a.spread)
        const { x, y } = orbitPt(phase, cx, cy, bA, bB, beltTilt)
        const sc = orbitScale(phase) * 0.65
        drawAsteroid(bctx, x, y, a.r, a.sides, a.rot + phase * 0.3, sc)
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
      drawPlanet(bctx, oPos.x, oPos.y, 22, oSc, { ring: true, bands: true, moon: true })

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
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', sync) }
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
