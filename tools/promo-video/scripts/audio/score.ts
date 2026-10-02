import type { Energy, Format, Shot } from '../../src/timeline'
import type { StereoBus } from './synth'
import { filmSpecs, fps, framesPerBeat } from '../../src/timeline'
import { bass, BEAT, createBus, hat, impact, kick, pad, pluck, snare, sweep } from './synth'

const harmony = [
  { root: 38, notes: [50, 53, 57, 60, 64], arp: [74, 77, 81, 76, 72, 77, 69, 76] },
  { root: 34, notes: [46, 50, 53, 57, 60], arp: [74, 77, 81, 72, 70, 77, 69, 74] },
  { root: 41, notes: [48, 53, 57, 60, 64], arp: [72, 77, 81, 76, 79, 77, 69, 76] },
  { root: 36, notes: [48, 52, 55, 60, 62], arp: [74, 76, 79, 72, 67, 76, 72, 74] },
]

const dynamics: Record<Energy, number> = { hook: 0.98, build: 0.84, drive: 1, outro: 0.77 }

function brandMotif(bus: StereoBus, at: number, gain: number) {
  for (const [index, midi] of [74, 81, 76, 86].entries()) {
    pluck(bus, at + index * BEAT / 2, midi, gain * (index === 3 ? 0.8 : 1), index % 2 ? 0.22 : -0.22, true)
  }
}

function scoreShot(bus: StereoBus, shot: Shot, index: number, endingAt: number) {
  const at = shot.startFrame / fps
  const chord = harmony[shot.energy === 'outro' ? 0 : index % harmony.length]
  const gain = dynamics[shot.energy]
  const length = Math.min(shot.frames / fps + 0.24, endingAt - at + 0.2)
  for (const [voice, note] of chord.notes.entries()) {
    pad(bus, at, length, note, (voice - 2) * 0.36, 0.025 * gain)
  }

  for (const [cueIndex, frame] of shot.cues.entries()) {
    const cueAt = (shot.startFrame + frame) / fps
    if (cueAt >= endingAt) {
      continue
    }
    const cueGain = cueIndex === 0 ? 1 : 0.7
    impact(bus, cueAt + 0.003, 9901 + index * 7 + cueIndex, 0.12 * gain * cueGain)
    sweep(bus, cueAt, 1701 + index * 7 + cueIndex, 0.13 * gain * cueGain)
    pluck(bus, cueAt, chord.arp[(cueIndex * 2) % chord.arp.length], 0.058 * gain, 0, true)
  }

  for (let beat = 0; beat < shot.frames / framesPerBeat; beat++) {
    const beatAt = at + beat * BEAT
    if (beatAt >= endingAt) {
      break
    }
    const actionBeat = shot.cues.includes(beat * framesPerBeat)
    const transientGain = actionBeat ? 1.16 : 1
    // 第一拍直接进入，快剪版本不等待铺垫完成才加入鼓组。
    kick(bus, beatAt + 0.003, 0.34 * gain * transientGain)
    bass(bus, beatAt + BEAT * 0.1, chord.root, BEAT * 0.65, 0.15 * gain)
    if (beat % 2 === 1) {
      snare(bus, beatAt, 0.2 * gain, 1000 + index * 31 + beat)
    }
    const subdivisions = shot.energy === 'drive' || shot.energy === 'hook' ? 4 : 2
    for (let tick = 0; tick < subdivisions; tick++) {
      const strong = tick * 2 === subdivisions
      const strength = strong ? 0.2 : tick % 2 ? 0.065 : 0.12
      hat(bus, beatAt + tick * BEAT / subdivisions, strength * gain, tick % 2 ? 0.35 : -0.3, index * 71 + beat * 13 + tick, strong && beat % 4 === 3)
    }
    if (shot.energy === 'drive' && beat % 4 === 3) {
      bass(bus, beatAt + BEAT * 0.75, chord.root + 12, BEAT * 0.22, 0.065)
      snare(bus, beatAt + BEAT * 0.75, 0.05, 1103 + index * 31 + beat)
    }
    for (let half = 0; half < 2; half++) {
      const step = beat * 2 + half
      const accent = step % 4 === 0 ? 1 : 0.65
      pluck(bus, beatAt + half * BEAT / 2, chord.arp[step % chord.arp.length], 0.047 * gain * accent, half ? 0.42 : -0.42)
    }
  }
}

/** 时长、镜头节奏、动作拍点与能量完全取自视频共享时间线。 */
export function compose(format: Format): StereoBus {
  const film = filmSpecs.find(candidate => candidate.name === format)
  if (!film) {
    throw new Error(`未知视频画幅：${format}`)
  }
  const bus = createBus(film.seconds)
  const endingAt = film.seconds - 2
  for (const [index, shot] of film.shots.entries()) {
    scoreShot(bus, shot, index, endingAt)
  }
  brandMotif(bus, BEAT / 2, 0.066)
  brandMotif(bus, endingAt + 0.08, 0.073)
  sweep(bus, endingAt, 1907, 0.1)
  impact(bus, endingAt, 1983, 0.1)
  bass(bus, endingAt + 0.01, harmony[0].root, 0.65, 0.11)
  for (const [index, note] of harmony[0].notes.entries()) {
    pad(bus, endingAt - 0.25, 2.25, note, (index - 2) * 0.35, 0.025)
  }
  return bus
}
