import type { StereoBus } from './synth'
import { Buffer } from 'node:buffer'
import { BEAT, SAMPLE_RATE } from './synth'

/** 稀疏早反射与拍点延迟增加空间，同时保留居中的低频。 */
export function finishMix(bus: StereoBus): StereoBus {
  const dryLeft = bus.left.slice()
  const dryRight = bus.right.slice()
  const reflections = [
    { time: 0.037, gain: 0.075 },
    { time: 0.071, gain: 0.06 },
    { time: 0.113, gain: 0.047 },
    { time: BEAT * 0.75, gain: 0.095 },
    { time: BEAT * 1.5, gain: 0.055 },
    { time: BEAT * 2.25, gain: 0.027 },
  ]
  for (const { time, gain } of reflections) {
    const offset = Math.round(time * SAMPLE_RATE)
    let lowLeft = 0
    let lowRight = 0
    let smoothLeft = 0
    let smoothRight = 0
    for (let i = offset; i < bus.left.length; i++) {
      lowLeft += 0.035 * (dryLeft[i - offset] - lowLeft)
      lowRight += 0.035 * (dryRight[i - offset] - lowRight)
      smoothLeft += 0.38 * (dryLeft[i - offset] - lowLeft - smoothLeft)
      smoothRight += 0.38 * (dryRight[i - offset] - lowRight - smoothRight)
      bus.left[i] += smoothRight * gain
      bus.right[i] += smoothLeft * gain
    }
  }
  const end = bus.left.length - 1
  let lowLeft = 0
  let lowRight = 0
  for (let i = 0; i < bus.left.length; i++) {
    const fade = Math.min(1, i / (SAMPLE_RATE * 0.005), (end - i) / (SAMPLE_RATE * 0.6))
    lowLeft += 0.002 * (bus.left[i] - lowLeft)
    lowRight += 0.002 * (bus.right[i] - lowRight)
    bus.left[i] = Math.tanh((bus.left[i] - lowLeft) * 1.05) * fade
    bus.right[i] = Math.tanh((bus.right[i] - lowRight) * 1.05) * fade
  }
  return bus
}

/** 写入标准 24 位 PCM WAV，避免中间有损压缩。 */
export function encodeWave(bus: StereoBus): Buffer {
  const dataSize = bus.left.length * 6
  const wav = Buffer.allocUnsafe(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(SAMPLE_RATE, 24)
  wav.writeUInt32LE(SAMPLE_RATE * 6, 28)
  wav.writeUInt16LE(6, 32)
  wav.writeUInt16LE(24, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < bus.left.length; i++) {
    wav.writeIntLE(Math.round(Math.max(-1, Math.min(1, bus.left[i])) * 0x7FFFFF), 44 + i * 6, 3)
    wav.writeIntLE(Math.round(Math.max(-1, Math.min(1, bus.right[i])) * 0x7FFFFF), 47 + i * 6, 3)
  }
  return wav
}
