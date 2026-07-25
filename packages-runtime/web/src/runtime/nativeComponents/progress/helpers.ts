export type ProgressActiveMode = 'backwards' | 'forwards'

export interface ProgressConfigInput {
  percent?: unknown
  strokeWidth?: unknown
  duration?: unknown
  borderRadius?: unknown
  fontSize?: unknown
  activeMode?: unknown
}

export interface ProgressConfig {
  percent: number
  strokeWidth: number
  duration: number
  borderRadius: number
  fontSize: number
  activeMode: ProgressActiveMode
}

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function nonNegativeNumber(value: unknown, fallback: number) {
  return Math.max(0, finiteNumber(value, fallback))
}

export function resolveProgressConfig(input: ProgressConfigInput = {}): ProgressConfig {
  const activeMode = input.activeMode === 'forwards' ? 'forwards' : 'backwards'
  return {
    percent: Math.min(100, Math.max(0, finiteNumber(input.percent, 0))),
    strokeWidth: nonNegativeNumber(input.strokeWidth, 6),
    duration: nonNegativeNumber(input.duration, 30),
    borderRadius: nonNegativeNumber(input.borderRadius, 0),
    fontSize: nonNegativeNumber(input.fontSize, 16),
    activeMode,
  }
}

export function resolveProgressAnimationDuration(start: number, end: number, durationPerPercent: number) {
  return Math.abs(end - start) * durationPerPercent
}

export function createProgressActiveEndDetail() {
  return {}
}
