import { afterEach, expect, it, vi } from 'vitest'
import { createFrameworkPhaseDiagnostics, FRAMEWORK_PHASE_PREFIX, observeFrameworkPhase } from './frameworkDiagnostics'

const { writeSync } = vi.hoisted(() => ({ writeSync: vi.fn() }))
vi.mock('node:fs', () => ({ writeSync }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('returns the original promise without reading a clock or producing events when disabled', async () => {
  const now = vi.spyOn(performance, 'now')
  const timeOrigin = vi.spyOn(performance, 'timeOrigin', 'get')
  const observe = vi.fn()
  const operation = Promise.resolve('original')
  const diagnostics = createFrameworkPhaseDiagnostics(false, { mode: 'weapp-stateful', role: 'incremental' }, observe)

  expect(observeFrameworkPhase(diagnostics, 'source-write', () => operation)).toBe(operation)
  await operation
  expect(now).not.toHaveBeenCalled()
  expect(timeOrigin).not.toHaveBeenCalled()
  expect(observe).not.toHaveBeenCalled()
})

it('attributes actual waits to the worker role and step using one monotonic clock', async () => {
  vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(35).mockReturnValueOnce(40).mockReturnValueOnce(43)
  vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(1000)
  const observe = vi.fn()
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-stateful', role: 'fresh-4' }, observe)!
  diagnostics.setStep(0)
  const pending = Promise.withResolvers<string>()
  const result = observeFrameworkPhase(diagnostics, 'listen', () => pending.promise)
  expect(observe.mock.calls.map(([event]) => event)).toEqual([
    { id: 1, mode: 'weapp-stateful', role: 'fresh-4', step: 0, phase: 'listen', status: 'started', timeOrigin: 1000, startedAtMs: 10 },
  ])
  pending.resolve('ready')
  await expect(result).resolves.toBe('ready')
  await observeFrameworkPhase(diagnostics, 'server-close', async () => undefined)
  expect(observe.mock.calls.map(([event]) => event)).toMatchObject([
    { id: 1, phase: 'listen', status: 'started' },
    { id: 1, phase: 'listen', status: 'completed', startedAtMs: 10, endedAtMs: 35, elapsedMs: 25 },
    { id: 2, phase: 'server-close', status: 'started', startedAtMs: 40 },
    { id: 2, phase: 'server-close', status: 'completed', endedAtMs: 43, elapsedMs: 3 },
  ])
})

it.each(['rejection', 'throw'] as const)('preserves the original %s and its failed boundary before a separate cleanup', async (kind) => {
  const observe = vi.fn()
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-classic', role: 'incremental' }, observe)!
  diagnostics.setStep(14)
  const failure = new DOMException('original deadline', 'TimeoutError')
  const operation = () => {
    if (kind === 'throw') {
      throw failure
    }
    return Promise.reject(failure)
  }
  if (kind === 'throw') {
    expect(() => observeFrameworkPhase(diagnostics, 'runtime-observe', operation)).toThrow(failure)
  }
  else {
    await expect(observeFrameworkPhase(diagnostics, 'runtime-observe', operation)).rejects.toBe(failure)
  }
  await observeFrameworkPhase(diagnostics, 'runtime-close', async () => undefined)
  expect(observe.mock.calls.map(([event]) => event)).toMatchObject([
    { id: 1, step: 14, phase: 'runtime-observe', status: 'started' },
    { id: 1, step: 14, phase: 'runtime-observe', status: 'failed', errorName: 'TimeoutError' },
    { id: 2, phase: 'runtime-close', status: 'started' },
    { id: 2, phase: 'runtime-close', status: 'completed' },
  ])
})

it('streams the start before awaiting and leaves it available if the worker never finishes', () => {
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-stateful', role: 'fresh-30' })!
  void observeFrameworkPhase(diagnostics, 'create-server', () => new Promise(() => {}))
  expect(writeSync).toHaveBeenCalledOnce()
  const raw = String(writeSync.mock.calls[0]![1])
  expect(raw.startsWith(FRAMEWORK_PHASE_PREFIX)).toBe(true)
  expect(JSON.parse(raw.slice(FRAMEWORK_PHASE_PREFIX.length))).toMatchObject({ role: 'fresh-30', phase: 'create-server', status: 'started' })
})

it('does not replace success or failure when the diagnostic receiver throws', async () => {
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-stateful', role: 'incremental' }, () => {
    throw new Error('diagnostic sink')
  })
  await expect(observeFrameworkPhase(diagnostics, 'output-read', async () => 'unchanged')).resolves.toBe('unchanged')
  const failure = new Error('original publication failure')
  await expect(observeFrameworkPhase(diagnostics, 'output-read', async () => {
    throw failure
  })).rejects.toBe(failure)
})

it.each(['now', 'timeOrigin'] as const)('runs the original operation and cleanup when the initial %s clock fails', async (clock) => {
  const clockFailure = () => {
    throw new Error('diagnostic clock unavailable')
  }
  if (clock === 'now') {
    vi.spyOn(performance, 'now').mockImplementation(clockFailure)
  }
  else {
    vi.spyOn(performance, 'timeOrigin', 'get').mockImplementation(clockFailure)
  }
  const observe = vi.fn()
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-stateful', role: 'incremental' }, observe)
  const original = Promise.resolve('complete')
  const operation = vi.fn(() => original)
  expect(observeFrameworkPhase(diagnostics, 'source-write', operation)).toBe(original)
  expect(operation).toHaveBeenCalledOnce()
  await expect(original).resolves.toBe('complete')
  const failure = new Error('original observation failure')
  expect(() => observeFrameworkPhase(diagnostics, 'runtime-observe', () => {
    throw failure
  })).toThrow(failure)
  await expect(observeFrameworkPhase(diagnostics, 'runtime-observe', () => Promise.reject(failure))).rejects.toBe(failure)
  const close = vi.fn(async () => undefined)
  await observeFrameworkPhase(diagnostics, 'server-close', close)
  expect(close).toHaveBeenCalledOnce()
  expect(observe).not.toHaveBeenCalled()
})

it.each(['success', 'rejection', 'throw'] as const)('preserves original %s and cleanup when the finish clock fails', async (kind) => {
  vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockImplementationOnce(() => {
    throw new Error('finish clock unavailable')
  })
  const observe = vi.fn()
  const diagnostics = createFrameworkPhaseDiagnostics(true, { mode: 'weapp-stateful', role: 'fresh-30' }, observe)
  const failure = new Error('original source failure')
  const operation = vi.fn(() => {
    if (kind === 'throw') {
      throw failure
    }
    return kind === 'rejection' ? Promise.reject(failure) : Promise.resolve('complete')
  })
  if (kind === 'throw') {
    expect(() => observeFrameworkPhase(diagnostics, 'source-write', operation)).toThrow(failure)
  }
  else if (kind === 'rejection') {
    await expect(observeFrameworkPhase(diagnostics, 'source-write', operation)).rejects.toBe(failure)
  }
  else {
    await expect(observeFrameworkPhase(diagnostics, 'source-write', operation)).resolves.toBe('complete')
  }
  expect(operation).toHaveBeenCalledOnce()
  const close = vi.fn(async () => undefined)
  await observeFrameworkPhase(diagnostics, 'server-close', close)
  expect(close).toHaveBeenCalledOnce()
  expect(observe.mock.calls.map(([event]) => event)).toMatchObject([
    { id: 1, phase: 'source-write', status: 'started' },
    { id: 2, phase: 'server-close', status: 'started' },
    { id: 2, phase: 'server-close', status: 'completed' },
  ])
})
