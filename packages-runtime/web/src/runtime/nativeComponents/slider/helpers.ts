export interface SliderConfigInput {
  min?: unknown
  max?: unknown
  step?: unknown
  value?: unknown
  blockSize?: unknown
}

export interface SliderConfig {
  min: number
  max: number
  step: number
  value: number
  blockSize: number
}

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function resolveSliderConfig(input: SliderConfigInput = {}): SliderConfig {
  const min = finiteNumber(input.min, 0)
  const requestedMax = finiteNumber(input.max, 100)
  const max = requestedMax > min ? requestedMax : min + 100
  const requestedStep = finiteNumber(input.step, 1)
  const step = requestedStep > 0 ? requestedStep : 1
  const rawValue = Math.min(Math.max(finiteNumber(input.value, min), min), max)
  const steps = Math.round((rawValue - min) / step)
  const value = Math.min(max, Math.max(min, min + steps * step))
  const blockSize = Math.min(28, Math.max(12, finiteNumber(input.blockSize, 28)))
  return { min, max, step, value, blockSize }
}

export function createSliderEventDetail(value: number) {
  return { value }
}
