import { describe, expect, it } from 'vitest'
import { calibrateBatch } from './calibration'
import { validCalibrationEvidence } from './calibrationIntegrity'

describe('calibration evidence replay', () => {
  it('accepts complete paired and informational calibration probes', () => {
    expect(validCalibrationEvidence(calibrateBatch(() => 25, true), true)).toBe(true)
    expect(validCalibrationEvidence(calibrateBatch(() => 0, false), false)).toBe(true)
  })

  it.each([
    ['missing probe', (value: ReturnType<typeof calibrateBatch>) => { value.probes.pop() }],
    ['batch replaced', (value: ReturnType<typeof calibrateBatch>) => { value.iterations++ }],
    ['probe order replaced', (value: ReturnType<typeof calibrateBatch>) => { value.probes.reverse() }],
    ['nonfinite duration', (value: ReturnType<typeof calibrateBatch>) => { value.probes[0]!.durationMs = Number.NaN }],
    ['extra probe', (value: ReturnType<typeof calibrateBatch>) => { value.probes.push(value.probes[0]!) }],
  ] as const)('rejects %s', (_name, mutate) => {
    const calibration = calibrateBatch(() => 25, true)
    mutate(calibration)
    expect(validCalibrationEvidence(calibration, true)).toBe(false)
  })
})
