import type { VerificationTiming } from '../../e2e/scripts/verification/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCaseTimingRecorder } from '../../e2e/scripts/verification/caseTiming'
import { assertE2ETimings, measureE2EPhase } from '../../e2e/scripts/verification/timing'
import { createFixtureSessionOwner } from '../../e2e/utils/fixtureSession'

afterEach(() => vi.restoreAllMocks())

describe('fixture session ownership', () => {
  it('builds and launches once, defers child cleanup and closes once at the aggregate boundary', async () => {
    const session = { id: 'owned-session' }
    const build = vi.fn(async () => {})
    const launch = vi.fn(async () => session)
    const close = vi.fn(async () => {})
    const owner = createFixtureSessionOwner({ build, launch, close, deferClose: () => true })
    expect(await Promise.all([owner.get(), owner.get()])).toEqual([session, session])
    await owner.close()
    expect(close).not.toHaveBeenCalled()
    await Promise.all([owner.close(true), owner.close(true)])
    expect(build).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledExactlyOnceWith(session)
    await expect(owner.get()).rejects.toThrow('closed')
    await owner.close(true)
    expect(close).toHaveBeenCalledOnce()
  })

  it('latches startup failure instead of rebuilding for each case', async () => {
    const failure = new Error('build failed')
    const build = vi.fn(async () => {
      throw failure
    })
    const launch = vi.fn(async () => ({}))
    const close = vi.fn(async () => {})
    const owner = createFixtureSessionOwner({ build, launch, close })
    await expect(owner.get()).rejects.toBe(failure)
    await expect(owner.get()).rejects.toBe(failure)
    await owner.close(true)
    expect(build).toHaveBeenCalledOnce()
    expect(launch).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('rejects late borrowers during cleanup and retries only its own failed close', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const session = { id: 'owned' }
    const close = vi.fn(async () => {
      await gate
    }).mockRejectedValueOnce(new Error('close failed'))
    const owner = createFixtureSessionOwner({ build: async () => {}, launch: async () => session, close })
    await owner.get()
    await expect(owner.close()).rejects.toThrow('close failed')
    const closing = owner.close()
    await expect(owner.get()).rejects.toThrow('closing')
    release()
    await closing
    expect(close).toHaveBeenCalledTimes(2)
  })
})

describe('E2E diagnostic timing', () => {
  it('rejects invalid durations and repeated invocation identities across report stages', () => {
    const timing: VerificationTiming = { name: 'build', invocationId: 'build-once', startedAt: '2026-10-19T00:00:00.000Z', durationMs: 2, status: 'passed' }
    expect(() => assertE2ETimings([timing])).not.toThrow()
    expect(() => assertE2ETimings([timing, timing])).toThrow('Invalid')
    for (const durationMs of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() => assertE2ETimings([{ ...timing, durationMs }])).toThrow('Invalid')
    }
    for (const status of [['passed'], { toString: () => 'passed' }, null, undefined, 0]) {
      expect(() => assertE2ETimings([{ ...timing, status }])).toThrow('Invalid')
    }
  })

  it('records monotonic durations and failure state without replacing the original error', async () => {
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
    expect(new Set(timings.map(timing => timing.invocationId)).size).toBe(timings.length)
  })

  it('records logical groups inside one aggregate without changing case names or starting sessions', () => {
    const timings: VerificationTiming[] = []
    const recorder = createCaseTimingRecorder(timing => timings.push(timing))
    recorder.start('a', 'github lifecycle > mounted')
    recorder.complete('a', 'passed', { startTime: Date.now(), duration: 10 })
    recorder.complete('a', 'passed', { startTime: Date.now(), duration: 10 })
    recorder.start('b', 'github lifecycle > guards')
    recorder.complete('b', 'failed', { startTime: Date.now(), duration: 20 })
    recorder.start('c', 'github props > first paint')
    recorder.start('d', 'github lifecycle > interrupted case')
    recorder.finish()
    expect(timings.filter(timing => timing.name.startsWith('case:'))).toHaveLength(4)
    expect(timings.find(timing => timing.name === 'case-group:github lifecycle')?.status).toBe('failed')
    expect(timings.find(timing => timing.name === 'case-group:github props')?.status).toBe('cancelled')
    expect(timings.filter(timing => timing.group === 'github lifecycle' && timing.name.startsWith('case:')).map(timing => timing.name)).toEqual(['case:github lifecycle > mounted', 'case:github lifecycle > guards', 'case:github lifecycle > interrupted case'])
  })

  it('uses worker diagnostics despite delayed reporter delivery and sums their actual durations', () => {
    const timings: VerificationTiming[] = []
    const recorder = createCaseTimingRecorder(timing => timings.push(timing))
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100)
    const startTime = Date.parse('2026-10-19T00:00:00.000Z')
    recorder.start('form', 'tdesign > form')
    clock.mockReturnValue(3_600)
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
    expect(timings[1]?.startedAt).toBe(new Date(startTime + 4_000).toISOString())
  })

  it('uses a fallback only for unfinished cancellation and omits completed cases missing diagnostics', () => {
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

  it('finishes every logical group even when the diagnostic sink fails', () => {
    const attempts: VerificationTiming[] = []
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
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
    expect(stderr).toHaveBeenCalledTimes(4)
  })
})
