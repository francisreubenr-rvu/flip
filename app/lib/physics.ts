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
