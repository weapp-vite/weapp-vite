import type { VerificationTiming } from '../../e2e/scripts/verification/types'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCaseTimingRecorder } from '../../e2e/scripts/verification/caseTiming'
import { measureE2EPhase } from '../../e2e/scripts/verification/timing'

afterEach(() => vi.restoreAllMocks())

describe('E2E diagnostic observation', () => {
  it('preserves operation results and original failures when diagnostic writing fails', async () => {
    const timings: VerificationTiming[] = []
    expect(await measureE2EPhase('build', async () => 42, timing => timings.push(timing))).toBe(42)
    const original = new Error('operation failed')
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(measureE2EPhase('launch', async () => {
      throw original
    }, () => {
      throw new Error('diagnostic write failed')
    })).rejects.toBe(original)
    await expect(measureE2EPhase('abort', async () => {
      throw new DOMException('cancelled', 'AbortError')
    }, timing => timings.push(timing))).rejects.toThrow('cancelled')
    expect(timings.map(timing => timing.status)).toEqual(['passed', 'cancelled'])
    expect(timings.every(timing => Number.isFinite(timing.durationMs) && timing.durationMs >= 0)).toBe(true)
  })

  it('uses actual worker case durations despite delayed reporter callbacks', () => {
    const timings: VerificationTiming[] = []
    const recorder = createCaseTimingRecorder(timing => timings.push(timing))
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100)
    const startTime = Date.parse('2026-10-19T00:00:00.000Z')
    recorder.start('form', 'tdesign > form')
    clock.mockReturnValue(3_600)
    recorder.complete('form', 'passed', { startTime, duration: 1_620 })
    recorder.complete('form', 'passed', { startTime, duration: 1_620 })
    recorder.start('layout', 'tdesign > layout')
    clock.mockReturnValue(3_691)
    recorder.complete('layout', 'passed', { startTime: startTime + 4_000, duration: 1_994 })
    recorder.finish()
    expect(timings.map(({ name, durationMs }) => [name, durationMs])).toEqual([
      ['case:tdesign > form', 1_620],
      ['case:tdesign > layout', 1_994],
      ['case-group:tdesign', 3_614],
    ])
    expect(timings[0]?.startedAt).toBe(new Date(startTime).toISOString())
  })

  it('uses a clock fallback only for unfinished cancellation', () => {
    const timings: VerificationTiming[] = []
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100)
    const recorder = createCaseTimingRecorder(timing => timings.push(timing))
    recorder.start('finished', 'tdesign > finished')
    recorder.complete('finished', 'passed')
    recorder.start('unfinished', 'tdesign > unfinished')
    clock.mockReturnValue(175)
    recorder.finish()
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Missing actual Vitest case diagnostic'))
    expect(timings.map(({ name, durationMs, status }) => [name, durationMs, status])).toEqual([
      ['case:tdesign > unfinished', 75, 'cancelled'],
      ['case-group:tdesign', 75, 'cancelled'],
    ])
  })

  it('finishes every group when its diagnostic sink is unavailable', () => {
    const attempts: VerificationTiming[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const recorder = createCaseTimingRecorder((timing) => {
      attempts.push(timing)
      throw new Error('timing storage unavailable')
    })
    recorder.start('a', 'github guards > abort')
    recorder.start('b', 'github props > initial paint')
    expect(() => recorder.complete('a', 'failed', { startTime: Date.now(), duration: 5 })).not.toThrow()
    expect(() => recorder.finish()).not.toThrow()
    expect(attempts.map(timing => [timing.name, timing.status])).toEqual([
      ['case:github guards > abort', 'failed'],
      ['case:github props > initial paint', 'cancelled'],
      ['case-group:github guards', 'failed'],
      ['case-group:github props', 'cancelled'],
    ])
    recorder.finish()
    expect(attempts).toHaveLength(4)
  })
})
