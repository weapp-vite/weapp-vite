import type { StereoBus } from './synth'
import { bass, BEAT, createBus, hat, kick, pad, pluck, snare, sweep } from './synth'

const harmony = [
  { root: 38, notes: [50, 53, 57, 60, 64], arp: [74, 77, 81, 76, 72, 77, 69, 76] },
  { root: 34, notes: [46, 50, 53, 57, 60], arp: [74, 77, 81, 72, 70, 77, 69, 74] },
  { root: 41, notes: [48, 53, 57, 60, 64], arp: [72, 77, 81, 76, 79, 77, 69, 76] },
  { root: 36, notes: [48, 52, 55, 60, 62], arp: [74, 76, 79, 72, 67, 76, 72, 74] },
]

interface Arrangement {
  seconds: number
  bars: number
  firstBeat: number
  coreAt: number
  endingAt: number
  cuts: number[]
}

const arrangements: Record<'landscape' | 'portrait', Arrangement> = {
  landscape: { seconds: 60, bars: 32, firstBeat: 8, coreAt: 14, endingAt: 52, cuts: [4, 14, 30, 40, 52] },
  portrait: { seconds: 30, bars: 16, firstBeat: 6, coreAt: 8, endingAt: 26, cuts: [3, 8, 18, 22, 26] },
}

function brandMotif(bus: StereoBus, at: number, gain: number) {
  for (const [index, midi] of [74, 81, 76, 86].entries()) {
    pluck(bus, at + index * BEAT / 2, midi, gain * (index === 3 ? 0.8 : 1), index % 2 ? 0.22 : -0.22, true)
  }
}

/** 两个画幅独立编排，同时共享主题动机与 D 小调和声。 */
export function compose(format: 'landscape' | 'portrait'): StereoBus {
  const arrangement = arrangements[format]
  const { seconds, bars, firstBeat, coreAt, endingAt, cuts } = arrangement
  const bus = createBus(seconds)
  const endingBar = Math.floor(endingAt / (BEAT * 4))

  for (let bar = 0; bar < bars; bar += 2) {
    const chord = harmony[Math.floor(bar / 2) % harmony.length]
    const start = bar * 4 * BEAT
    if (start >= endingAt) {
      break
    }
    const gain = start < 4 ? 0.019 : 0.026
    for (const [index, note] of chord.notes.entries()) {
      pad(bus, start, Math.min(8 * BEAT + 1, endingAt - start + 0.3), note, (index - 2) * 0.36, gain)
    }
  }

  for (let beat = firstBeat; beat < bars * 4; beat++) {
    const at = beat * BEAT
    if (at >= endingAt - BEAT / 2) {
      break
    }
    const bar = Math.floor(beat / 4)
    const chord = harmony[Math.floor(bar / 2) % harmony.length]
    const energy = at < coreAt ? 0.66 : at > endingAt - 4 ? 0.85 : 1
    const breakBeforeCut = cuts.some(cut => at > cut - BEAT * 0.7 && at < cut)
    const breakdown = format === 'landscape' && at >= 37.5 && at < 39.5
    if (!breakBeforeCut && !breakdown) {
      kick(bus, at, 0.32 * energy)
      bass(bus, at + BEAT * 0.11, chord.root, BEAT * 0.73, 0.13 * energy)
      if (beat % 2 === 1) {
        snare(bus, at, 0.15 * energy, 1000 + beat)
      }
      for (let half = 0; half < 2; half++) {
        hat(bus, at + half * BEAT / 2, (half ? 0.22 : 0.1) * energy, half ? 0.33 : -0.3, beat * 39 + half, half === 1 && beat % 4 === 3)
      }
      if (at > coreAt && beat % 4 === 3) {
        bass(bus, at + BEAT * 0.8, chord.root + 12, BEAT * 0.19, 0.05)
      }
    }
    for (let half = 0; half < 2; half++) {
      const step = beat * 2 + half
      if (at < coreAt && step % 2 === 1) {
        continue
      }
      const note = chord.arp[step % chord.arp.length]
      const accent = step % 4 === 0 ? 1 : 0.65
      pluck(bus, at + half * BEAT / 2, note, 0.036 * energy * accent, half ? 0.42 : -0.42)
    }
    if (bar >= endingBar - 4 && beat % 4 === 0) {
      pluck(bus, at + BEAT / 4, chord.notes[3] + 12, 0.023, -0.1, true)
    }
  }

  brandMotif(bus, 0.7, 0.075)
  brandMotif(bus, endingAt + 0.38, 0.095)
  for (const [index, cut] of cuts.entries()) {
    sweep(bus, cut, 1701 + index, index === cuts.length - 1 ? 0.16 : 0.11)
  }

  // 片尾在 Dm9 上解决，短版与长版均为专门编排的落点。
  for (const [index, note] of harmony[0].notes.entries()) {
    pad(bus, endingAt, seconds - endingAt, note, (index - 2) * 0.35, 0.03)
  }
  bass(bus, endingAt + 0.02, 38, Math.min(1.5, seconds - endingAt), 0.12)
  kick(bus, endingAt, 0.25)
  return bus
}
