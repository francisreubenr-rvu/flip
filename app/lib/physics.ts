// ─── Vec2 ─────────────────────────────────────────────────────────────────────
export interface Vec2 { x: number; y: number }

export const v2 = {
  add(a: Vec2, b: Vec2): Vec2          { return { x: a.x + b.x, y: a.y + b.y } },
  sub(a: Vec2, b: Vec2): Vec2          { return { x: a.x - b.x, y: a.y - b.y } },
  scale(a: Vec2, s: number): Vec2      { return { x: a.x * s, y: a.y * s } },
  magnitude(a: Vec2): number           { return Math.hypot(a.x, a.y) },
  normalize(a: Vec2): Vec2 {
    const m = Math.hypot(a.x, a.y)
    return m < 1e-9 ? { x: 0, y: 0 } : { x: a.x / m, y: a.y / m }
  },
  dist(a: Vec2, b: Vec2): number       { return Math.hypot(b.x - a.x, b.y - a.y) },
  limit(a: Vec2, max: number): Vec2 {
    const m = Math.hypot(a.x, a.y)
    return m > max ? { x: (a.x / m) * max, y: (a.y / m) * max } : { x: a.x, y: a.y }
  },
  lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  },
  dot(a: Vec2, b: Vec2): number        { return a.x * b.x + a.y * b.y },
  distSq(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x, dy = b.y - a.y; return dx * dx + dy * dy
  },
}

// ─── Particle / Boid ──────────────────────────────────────────────────────────
export interface Particle { pos: Vec2; vel: Vec2; acc: Vec2; mass: number }
export interface Boid extends Particle { maxSpeed: number; maxForce: number }

// Euler integration: vel += acc; vel *= drag; pos += vel*dt; acc reset
export function step(b: Boid, dt: number, drag: number): void {
  b.vel = v2.add(b.vel, b.acc)
  b.vel = v2.scale(b.vel, drag)
  b.vel = v2.limit(b.vel, b.maxSpeed)
  b.pos = v2.add(b.pos, v2.scale(b.vel, dt))
  b.acc = { x: 0, y: 0 }
}

// ─── Steering forces ──────────────────────────────────────────────────────────

// Steer away from crowding; denominator clamped to prevent blowup at close range
export function separate(boid: Boid, neighbors: Boid[], radius: number, strength: number): Vec2 {
  let steer = { x: 0, y: 0 }
  let count = 0
  for (const other of neighbors) {
    const d = v2.dist(boid.pos, other.pos)
    if (d > 0 && d < radius) {
      const diff = v2.normalize(v2.sub(boid.pos, other.pos))
      steer = v2.add(steer, v2.scale(diff, 1 / Math.max(d, 0.5)))
      count++
    }
  }
  if (count === 0) return { x: 0, y: 0 }
  steer = v2.scale(steer, 1 / count)
  steer = v2.normalize(steer)
  steer = v2.scale(steer, boid.maxSpeed)
  steer = v2.sub(steer, boid.vel)
  return v2.limit(steer, boid.maxForce * strength)
}

// Match average velocity of neighbors within radius
export function align(boid: Boid, neighbors: Boid[], radius: number): Vec2 {
  let sum = { x: 0, y: 0 }
  let count = 0
  for (const other of neighbors) {
    if (v2.dist(boid.pos, other.pos) < radius) { sum = v2.add(sum, other.vel); count++ }
  }
  if (count === 0) return { x: 0, y: 0 }
  sum = v2.scale(sum, 1 / count)
  sum = v2.normalize(sum)
  sum = v2.scale(sum, boid.maxSpeed)
  return v2.limit(v2.sub(sum, boid.vel), boid.maxForce)
}

// Steer toward center of mass of neighbors within radius
export function cohere(boid: Boid, neighbors: Boid[], radius: number): Vec2 {
  let sum = { x: 0, y: 0 }
  let count = 0
  for (const other of neighbors) {
    if (v2.dist(boid.pos, other.pos) < radius) { sum = v2.add(sum, other.pos); count++ }
  }
  if (count === 0) return { x: 0, y: 0 }
  return seek(boid, v2.scale(sum, 1 / count), false)
}

// Steer toward target; arrival=true slows within 80px to prevent oscillation
export function seek(boid: Boid, target: Vec2, arrival = false): Vec2 {
  let desired = v2.sub(target, boid.pos)
  const d = v2.magnitude(desired)
  if (d < 0.01) return { x: 0, y: 0 }
  const SLOW_RADIUS = 80
  const speed = arrival && d < SLOW_RADIUS ? boid.maxSpeed * (d / SLOW_RADIUS) : boid.maxSpeed
  desired = v2.scale(v2.normalize(desired), speed)
  return v2.limit(v2.sub(desired, boid.vel), boid.maxForce)
}

// Repulsion force when within radius, else zero
export function flee(boid: Boid, threat: Vec2, radius: number): Vec2 {
  const d = v2.dist(boid.pos, threat)
  if (d >= radius || d < 0.01) return { x: 0, y: 0 }
  const desired = v2.scale(v2.normalize(v2.sub(boid.pos, threat)), boid.maxSpeed)
  return v2.limit(v2.sub(desired, boid.vel), boid.maxForce)
}

// Smooth wander: project circle ahead along vel, perturb by wanderTheta
// Caller updates: wanderTheta += (Math.random()-0.5)*0.25 each frame
export function wander(boid: Boid, wanderTheta: number, wanderRadius: number): Vec2 {
  const WANDER_DIST = 60
  const velMag = v2.magnitude(boid.vel)
  const ahead = velMag > 1e-6
    ? v2.scale(v2.normalize(boid.vel), WANDER_DIST)
    : { x: WANDER_DIST, y: 0 }
  const circleCenter = v2.add(boid.pos, ahead)
  const target: Vec2 = {
    x: circleCenter.x + Math.cos(wanderTheta) * wanderRadius,
    y: circleCenter.y + Math.sin(wanderTheta) * wanderRadius,
  }
  return seek(boid, target, false)
}

// ─── Kepler integration ───────────────────────────────────────────────────────
// Returns dν for this timestep using Kepler's second law (angular momentum conservation).
// dν/dt = ωMean * (1 + e·cos(ν))² / (1−e²)^(3/2)
// Clamp prevents spikes when dt hits the 50ms ceiling.
export function keplerStep(ν: number, e: number, ωMean: number, dt: number): number {
  const ecc2 = 1 - e * e
  const factor = Math.pow(ecc2, 1.5)
  const dν = ωMean * Math.pow(1 + e * Math.cos(ν), 2) / factor * dt
  return Math.min(dν, ωMean * dt * 6)
}

// ─── Arrival ──────────────────────────────────────────────────────────────────
export function arrival(boid: Boid, target: Vec2, slowRadius = 80): Vec2 {
  const desired = v2.sub(target, boid.pos)
  const d = v2.magnitude(desired)
  if (d < 0.01) return { x: 0, y: 0 }
  const speed = d < slowRadius ? boid.maxSpeed * (d / slowRadius) : boid.maxSpeed
  return v2.limit(v2.sub(v2.scale(v2.normalize(desired), speed), boid.vel), boid.maxForce)
}

// ─── Pursue ───────────────────────────────────────────────────────────────────
export function pursue(boid: Boid, targetPos: Vec2, targetVel: Vec2): Vec2 {
  const d = v2.dist(boid.pos, targetPos)
  const tPredict = Math.min(d / Math.max(boid.maxSpeed, 0.001), 2000)
  return seek(boid, { x: targetPos.x + targetVel.x * tPredict, y: targetPos.y + targetVel.y * tPredict }, false)
}

// ─── Evade ────────────────────────────────────────────────────────────────────
export function evade(boid: Boid, threatPos: Vec2, threatVel: Vec2, radius: number): Vec2 {
  const d = v2.dist(boid.pos, threatPos)
  const tPredict = Math.min(d / Math.max(boid.maxSpeed, 0.001), 2000)
  return flee(boid, { x: threatPos.x + threatVel.x * tPredict, y: threatPos.y + threatVel.y * tPredict }, radius)
}

// ─── Containment ──────────────────────────────────────────────────────────────
export function containment(
  boid: Boid,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  margin: number, strength = 1.5,
): Vec2 {
  const desired: Vec2 = { x: 0, y: 0 }
  if (boid.pos.x < bounds.minX + margin) desired.x = boid.maxSpeed
  else if (boid.pos.x > bounds.maxX - margin) desired.x = -boid.maxSpeed
  if (boid.pos.y < bounds.minY + margin) desired.y = boid.maxSpeed
  else if (boid.pos.y > bounds.maxY - margin) desired.y = -boid.maxSpeed
  if (v2.magnitude(desired) < 0.001) return { x: 0, y: 0 }
  return v2.limit(v2.sub(desired, boid.vel), boid.maxForce * strength)
}

// ─── Perception Filter ────────────────────────────────────────────────────────
export function perceptionFilter(boid: Boid, candidates: Boid[], fovCos = -0.5): Boid[] {
  if (v2.magnitude(boid.vel) < 1e-4) return candidates
  const fwd = v2.normalize(boid.vel)
  return candidates.filter(o => {
    const to = v2.sub(o.pos, boid.pos)
    const m = v2.magnitude(to)
    if (m < 1e-6) return false
    return (to.x * fwd.x + to.y * fwd.y) / m > fovCos
  })
}

// ─── Selfish Herd Cohere ──────────────────────────────────────────────────────
export function selfishHerdCohere(
  boid: Boid, neighbors: Boid[], radius: number, threat?: Vec2,
): Vec2 {
  if (!threat) return cohere(boid, neighbors, radius)
  let sumX = 0, sumY = 0, totalW = 0
  const selfD = v2.dist(boid.pos, threat)
  for (const other of neighbors) {
    if (v2.dist(boid.pos, other.pos) >= radius) continue
    const w = Math.max(0, selfD - v2.dist(other.pos, threat))
    sumX += other.pos.x * w; sumY += other.pos.y * w; totalW += w
  }
  if (totalW < 0.001) return cohere(boid, neighbors, radius)
  return seek(boid, { x: sumX / totalW, y: sumY / totalW }, false)
}

// ─── Leader Follow ────────────────────────────────────────────────────────────
export function leaderFollow(boid: Boid, leader: Boid, offset: Vec2): Vec2 {
  const fwd = v2.magnitude(leader.vel) > 1e-6 ? v2.normalize(leader.vel) : { x: 1, y: 0 }
  const perp: Vec2 = { x: -fwd.y, y: fwd.x }
  const slot: Vec2 = {
    x: leader.pos.x - fwd.x * offset.x + perp.x * offset.y,
    y: leader.pos.y - fwd.y * offset.x + perp.y * offset.y,
  }
  let force = arrival(boid, slot, 30)
  const toBoid = v2.sub(boid.pos, leader.pos)
  const m = v2.magnitude(toBoid)
  if (m > 1e-6 && (toBoid.x * fwd.x + toBoid.y * fwd.y) / m > 0.7) {
    force = v2.add(force, evade(boid, leader.pos, leader.vel, 60))
  }
  return force
}

// ─── Gravity Force ────────────────────────────────────────────────────────────
export function gravityForce(boid: Boid, attractor: Vec2, attractorMass: number, G = 1e-5): Vec2 {
  const dx = attractor.x - boid.pos.x, dy = attractor.y - boid.pos.y
  const r2 = Math.max(dx * dx + dy * dy, 100)
  const r = Math.sqrt(r2)
  const F = G * attractorMass * boid.mass / r2
  return { x: F * dx / r, y: F * dy / r }
}

// ─── Path Follow ──────────────────────────────────────────────────────────────
export function pathFollow(boid: Boid, path: Vec2[], pathRadius: number, closed = false): Vec2 {
  if (path.length < 2) return { x: 0, y: 0 }
  const fwd = v2.magnitude(boid.vel) > 1e-6 ? v2.normalize(boid.vel) : { x: 1, y: 0 }
  const future = v2.add(boid.pos, v2.scale(fwd, 25))
  let minDist = Infinity, bestTarget: Vec2 = path[0]
  const n = closed ? path.length : path.length - 1
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % path.length]
    const ab = v2.sub(b, a), af = v2.sub(future, a)
    const t = Math.max(0, Math.min(1, v2.dot(af, ab) / Math.max(v2.dot(ab, ab), 1e-9)))
    const proj = v2.add(a, v2.scale(ab, t))
    const d = v2.dist(future, proj)
    if (d < minDist) {
      minDist = d
      const norm = v2.magnitude(ab) > 1e-6 ? v2.normalize(ab) : { x: 1, y: 0 }
      bestTarget = v2.add(proj, v2.scale(norm, 30))
    }
  }
  if (minDist <= pathRadius) return { x: 0, y: 0 }
  return seek(boid, bestTarget, false)
}

// ─── Flow Field ───────────────────────────────────────────────────────────────
export function flowField(
  boid: Boid, sample: (x: number, y: number, t: number) => Vec2, t: number, weight = 1.0,
): Vec2 {
  const f = sample(boid.pos.x, boid.pos.y, t)
  const m = v2.magnitude(f)
  if (m < 1e-6) return { x: 0, y: 0 }
  return v2.limit(v2.sub(v2.scale(v2.normalize(f), boid.maxSpeed * weight), boid.vel), boid.maxForce)
}

// ─── Simplex Noise (internal) ─────────────────────────────────────────────────
const _PERM = (() => {
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
    69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,
    117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,
    46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
    200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,
    123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,
    39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,
    193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,
    181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,
    114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]
  const a = new Uint8Array(512)
  for (let i = 0; i < 512; i++) a[i] = p[i & 255]
  return a
})()
const _G3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]] as const
function _simplex2(x: number, y: number): number {
  const F = (Math.sqrt(3)-1)/2, G = (3-Math.sqrt(3))/6
  const s = (x+y)*F, i = Math.floor(x+s), j = Math.floor(y+s), t2 = (i+j)*G
  const x0 = x-(i-t2), y0 = y-(j-t2)
  const [i1,j1] = x0>y0 ? [1,0] : [0,1]
  const x1 = x0-i1+G, y1 = y0-j1+G, x2 = x0-1+2*G, y2 = y0-1+2*G
  const ii = i&255, jj = j&255
  const g0 = _PERM[ii+_PERM[jj]]%12, g1 = _PERM[ii+i1+_PERM[jj+j1]]%12, g2 = _PERM[ii+1+_PERM[jj+1]]%12
  let n = 0
  let t0 = 0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0; n+=t0*t0*(_G3[g0][0]*x0+_G3[g0][1]*y0)}
  let t1 = 0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1; n+=t1*t1*(_G3[g1][0]*x1+_G3[g1][1]*y1)}
  let t3 = 0.5-x2*x2-y2*y2; if(t3>=0){t3*=t3; n+=t3*t3*(_G3[g2][0]*x2+_G3[g2][1]*y2)}
  return 70*n
}

// ─── Simplex Flow ─────────────────────────────────────────────────────────────
export function simplexFlow(
  spaceScale = 0.0015, timeScale = 0.0002, strength = 1.0,
): (x: number, y: number, t: number) => Vec2 {
  return (x, y, t) => {
    const tx = t * timeScale
    return {
      x: _simplex2(x * spaceScale + tx,        y * spaceScale + tx        ) * strength,
      y: _simplex2(x * spaceScale + tx + 1000, y * spaceScale + tx + 1000 ) * strength,
    }
  }
}

// ─── Utility Score ────────────────────────────────────────────────────────────
export function utilityScore<A extends string>(
  actions: Record<A, (drives: Record<string, number>, ctx: Record<string, unknown>) => number>,
  drives: Record<string, number>,
  ctx: Record<string, unknown>,
): A {
  let best = '' as A, bestScore = -Infinity
  for (const key in actions) {
    const s = actions[key](drives, ctx)
    if (s > bestScore) { bestScore = s; best = key as A }
  }
  return best
}

// ─── Spatial Hash ─────────────────────────────────────────────────────────────
export class SpatialHash {
  private cells = new Map<number, Boid[]>()
  constructor(private cellSize: number) {}
  clear(): void { this.cells.clear() }
  insert(boid: Boid): void {
    const k = this._key(Math.floor(boid.pos.x / this.cellSize), Math.floor(boid.pos.y / this.cellSize))
    if (!this.cells.has(k)) this.cells.set(k, [])
    this.cells.get(k)!.push(boid)
  }
  queryNeighbors(boid: Boid, radius: number): Boid[] {
    const result: Boid[] = []
    const x0 = Math.floor((boid.pos.x - radius) / this.cellSize), x1 = Math.floor((boid.pos.x + radius) / this.cellSize)
    const y0 = Math.floor((boid.pos.y - radius) / this.cellSize), y1 = Math.floor((boid.pos.y + radius) / this.cellSize)
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.cells.get(this._key(cx, cy))
        if (bucket) for (const b of bucket) { if (b !== boid) result.push(b) }
      }
    return result
  }
  private _key(cx: number, cy: number): number { return (cx << 16) ^ (cy & 0xFFFF) }
}

// ─── Flock (convenience) ──────────────────────────────────────────────────────
export function flock(
  boid: Boid, neighbors: Boid[],
  sepRadius = 30, alignRadius = 70, cohereRadius = 90,
  sepW = 1.5, alignW = 1.0, cohereW = 1.0,
): Vec2 {
  return v2.add(
    v2.scale(separate(boid, neighbors, sepRadius, 1), sepW),
    v2.add(v2.scale(align(boid, neighbors, alignRadius), alignW), v2.scale(cohere(boid, neighbors, cohereRadius), cohereW)),
  )
}
