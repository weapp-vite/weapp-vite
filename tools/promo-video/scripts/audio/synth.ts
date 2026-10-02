export const SAMPLE_RATE = 48_000
export const BPM = 128
export const BEAT = 60 / BPM
const TAU = Math.PI * 2

export interface StereoBus {
  left: Float32Array
  right: Float32Array
}

export function createBus(seconds: number): StereoBus {
  return {
    left: new Float32Array(Math.round(seconds * SAMPLE_RATE)),
    right: new Float32Array(Math.round(seconds * SAMPLE_RATE)),
  }
}

export function frequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** 固定种子的白噪声用于鼓组和转场，确保离线渲染可以复现。 */
export function randomSource(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state / 2 ** 31 - 1
  }
}

/** 等功率声像保持左右声道的能量一致。 */
export function voice(
  bus: StereoBus,
  start: number,
  duration: number,
  amplitude: number,
  pan: number,
  oscillator: (time: number, index: number) => number,
) {
  const offset = Math.round(start * SAMPLE_RATE)
  const count = Math.min(Math.ceil(duration * SAMPLE_RATE), bus.left.length - offset)
  const left = Math.cos((pan + 1) * Math.PI / 4) * amplitude
  const right = Math.sin((pan + 1) * Math.PI / 4) * amplitude
  for (let i = Math.max(0, -offset); i < count; i++) {
    const sample = oscillator(i / SAMPLE_RATE, i)
    bus.left[offset + i] += sample * left
    bus.right[offset + i] += sample * right
  }
}

export function pad(bus: StereoBus, start: number, duration: number, midi: number, pan: number, gain: number) {
  const hz = frequency(midi)
  voice(bus, start, duration, gain, pan, (t) => {
    const attack = Math.min(1, t / 0.7)
    const release = Math.min(1, (duration - t) / 0.9)
    const duck = 0.78 + 0.22 * (1 - Math.exp(-((t + start) % BEAT) / 0.07))
    const warm = Math.sin(TAU * hz * t)
      + 0.31 * Math.sin(TAU * hz * 1.003 * t + 0.5)
      + 0.19 * Math.sin(TAU * hz * 0.997 * t - 0.5)
      + 0.13 * Math.sin(TAU * hz * 2 * t)
    return warm * attack * release * duck * (0.88 + 0.12 * Math.sin(TAU * 0.21 * t))
  })
}

export function pluck(bus: StereoBus, start: number, midi: number, gain: number, pan = 0, long = false) {
  const hz = frequency(midi)
  const duration = long ? 1.4 : 0.8
  voice(bus, start, duration, gain, pan, (t) => {
    const envelope = (1 - Math.exp(-t * 450)) * Math.exp(-t * (long ? 3 : 7))
    const brightness = Math.exp(-t * 10)
    return envelope * (Math.sin(TAU * hz * t)
      + 0.35 * brightness * Math.sin(TAU * hz * 2 * t)
      + 0.13 * brightness * Math.sin(TAU * hz * 3 * t))
  })
}

export function bass(bus: StereoBus, start: number, midi: number, length: number, gain: number) {
  const hz = frequency(midi)
  voice(bus, start, length, gain, 0, (t) => {
    const envelope = Math.min(1, t / 0.015) * Math.min(1, (length - t) / 0.065)
    const filter = Math.exp(-t * 8)
    const wave = Math.sin(TAU * hz * t)
      + 0.27 * Math.sin(TAU * hz * 2 * t)
      + 0.18 * filter * Math.sin(TAU * hz * 3 * t)
      + 0.08 * filter * Math.sin(TAU * hz * 4 * t)
    return Math.tanh(wave * 1.35) * envelope * (0.65 + 0.35 * Math.exp(-t * 4))
  })
}

export function kick(bus: StereoBus, start: number, gain: number) {
  voice(bus, start, 0.43, gain, 0, (t) => {
    const phase = TAU * (47 * t + 90 * 0.022 * (1 - Math.exp(-t / 0.022)))
    return Math.sin(phase) * (1 - Math.exp(-t * 900)) * Math.exp(-t * 11)
  })
}

export function snare(bus: StereoBus, start: number, gain: number, seed: number) {
  const random = randomSource(seed)
  let low = 0
  voice(bus, start, 0.25, gain, 0.08, (t) => {
    const noise = random()
    low += 0.35 * (noise - low)
    const clap = (noise - low) * Math.exp(-t * 22)
    const body = Math.sin(TAU * 185 * t) * Math.exp(-t * 35)
    return (clap * 0.64 + body * 0.3) * Math.min(1, t / 0.002)
  })
}

export function hat(bus: StereoBus, start: number, gain: number, pan: number, seed: number, open = false) {
  const random = randomSource(seed)
  let low = 0
  let smooth = 0
  voice(bus, start, open ? 0.25 : 0.09, gain, pan, (t) => {
    const noise = random()
    low += 0.72 * (noise - low)
    smooth += 0.42 * (noise - low - smooth)
    return smooth * Math.exp(-t * (open ? 16 : 55)) * Math.min(1, t / 0.002)
  })
}

/** 带限噪声的频率缓慢移动，形成柔和的扫频而非尖锐电子蜂鸣。 */
export function sweep(bus: StereoBus, at: number, seed: number, gain = 0.16) {
  const random = randomSource(seed)
  let lower = 0
  let upper = 0
  voice(bus, at - 0.55, 1.25, gain, 0, (t) => {
    const noise = random()
    const shape = t < 0.55 ? (t / 0.55) ** 2 : Math.exp(-(t - 0.55) * 8)
    const cutoff = 600 + 2200 * Math.sin(Math.PI * t / 1.25) ** 2
    const alpha = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE)
    lower += 0.03 * (noise - lower)
    upper += alpha * (noise - upper)
    return (upper - lower) * shape
  })
}
