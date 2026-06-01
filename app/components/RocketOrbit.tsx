'use client'
import { useRef, useEffect } from 'react'

// ─── Dynamic orbit params (updated on resize) ─────────────────────────────────
const TILT  = -12 * Math.PI / 180
const SPEED = 0.00016          // rad/ms  — ~39 s full orbit at viewport scale
const TRAIL = 30
const SPAN  = 0.8              // radians of trail

const COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT)

// ─── Orbit math ───────────────────────────────────────────────────────────────
function pt(θ: number, cx: number, cy: number, A: number, B: number) {
  const ex = A * Math.cos(θ), ey = B * Math.sin(θ)
  return { x: cx + ex * COS_T - ey * SIN_T, y: cy + ex * SIN_T + ey * COS_T }
}

function depth(θ: number) { return Math.sin(θ) }
function rscale(θ: number) { return 0.55 + 0.75 * (depth(θ) + 1) / 2 }

function tangent(θ: number, A: number, B: number) {
  const dx = -A * Math.sin(θ) * COS_T - B * Math.cos(θ) * SIN_T
  const dy = -A * Math.sin(θ) * SIN_T + B * Math.cos(θ) * COS_T
  return Math.atan2(dy, dx)
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

function drawOrbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, A: number, B: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(62,92,185,0.10)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 9])
  ctx.beginPath()
  for (let i = 0; i <= 360; i++) {
    const { x, y } = pt((i / 360) * Math.PI * 2, cx, cy, A, B)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawTrail(ctx: CanvasRenderingContext2D, θ: number, cx: number, cy: number, A: number, B: number) {
  for (let i = 1; i <= TRAIL; i++) {
    const t = θ - (i / TRAIL) * SPAN
    const { x, y } = pt(t, cx, cy, A, B)
    const d = depth(t), sc = rscale(t)
    const alpha = (1 - i / TRAIL) * 0.38 * Math.max(0, (d + 1.5) / 2.5)
    ctx.beginPath()
    ctx.arc(x, y, sc * 2.2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(62,92,185,${alpha.toFixed(3)})`
    ctx.fill()
  }
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, angle: number, now: number) {
  const flicker = 0.70 + 0.30 * Math.sin(now * 0.019)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle + Math.PI / 2)
  ctx.scale(sc, sc)

  // flame
  ctx.save()
  ctx.translate(0, 14)
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.bezierCurveTo(-4.5, 5 * flicker, -1.5, 11 * flicker, 0, 16 * flicker)
  ctx.bezierCurveTo(1.5, 11 * flicker, 4.5, 5 * flicker, 5, 0)
  ctx.closePath()
  ctx.fillStyle = `rgba(255,115,15,${(0.85 * flicker).toFixed(2)})`
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-2.5, 0)
  ctx.bezierCurveTo(-2, 4 * flicker, -0.6, 9 * flicker, 0, 12 * flicker)
  ctx.bezierCurveTo(0.6, 9 * flicker, 2, 4 * flicker, 2.5, 0)
  ctx.closePath()
  ctx.fillStyle = `rgba(255,225,55,${(0.92 * flicker).toFixed(2)})`
  ctx.fill()
  ctx.restore()

  rrect(ctx, -7, -14, 14, 28, 4)
  ctx.fillStyle = '#f5f0e8'; ctx.fill()
  ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-7, -14); ctx.lineTo(0, -26); ctx.lineTo(7, -14)
  ctx.fillStyle = '#f5f0e8'; ctx.fill()
  ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-7, 4); ctx.lineTo(-14, 16); ctx.lineTo(-7, 14); ctx.closePath()
  ctx.fillStyle = '#f5f0e8'; ctx.fill(); ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.2; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(7, 4); ctx.lineTo(14, 16); ctx.lineTo(7, 14); ctx.closePath()
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
  const θRef     = useRef(0)

  useEffect(() => {
    const back  = backRef.current
    const front = frontRef.current
    if (!back || !front) return

    const bctx = back.getContext('2d')  as CanvasRenderingContext2D
    const fctx = front.getContext('2d') as CanvasRenderingContext2D
    if (!bctx || !fctx) return

    let cx = 0, cy = 0, A = 400, B = 160

    function sync() {
      const vw = window.innerWidth, vh = window.innerHeight
      cx = vw / 2; cy = vh / 2
      A = Math.min(vw * 0.40, 560)
      B = Math.min(vh * 0.22, 210)
      back!.width  = front!.width  = vw
      back!.height = front!.height = vh
    }

    sync()
    window.addEventListener('resize', sync)

    let last = 0
    function frame(now: number) {
      const dt = Math.min(now - last, 50)
      last = now
      θRef.current += SPEED * dt
      const θ = θRef.current

      const vw = back!.width, vh = back!.height
      bctx.clearRect(0, 0, vw, vh)
      fctx.clearRect(0, 0, vw, vh)

      drawOrbit(bctx, cx, cy, A, B)
      drawTrail(bctx, θ, cx, cy, A, B)

      const { x, y } = pt(θ, cx, cy, A, B)
      const sc  = rscale(θ)
      const ang = tangent(θ, A, B)
      const far = depth(θ) < 0

      if (far) drawRocket(bctx, x, y, sc, ang, now)
      else     drawRocket(fctx, x, y, sc, ang, now)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', sync)
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
