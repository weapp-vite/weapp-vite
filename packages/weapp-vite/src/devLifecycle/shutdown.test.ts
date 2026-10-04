import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevShutdownScope, getDevShutdownScope } from './shutdown'

const initialExitCode = process.exitCode

beforeEach(() => {
  process.exitCode = undefined
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
})

afterEach(() => {
  process.exitCode = initialExitCode
  vi.restoreAllMocks()
})

it.each([
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['disconnect', 0],
  ['stdin', 0],
] as const)('retains the first exit request through repeated signals: %s', async (reason, code) => {
  const previous = process.listeners('SIGTERM')
  const scope = createDevShutdownScope()
  const released = Promise.withResolvers<void>()
  const close = vi.fn(() => released.promise)
  scope.own(close)
  scope.request(reason)
  scope.request('SIGINT')
  await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  expect(process.listeners('SIGTERM')).toHaveLength(previous.length + 1)
  expect(process.exitCode).toBeUndefined()
  released.resolve()
  await scope.close()
  expect(process.exitCode).toBe(code)
  expect(process.listeners('SIGTERM')).toEqual(previous)
})

it('waits for a late startup resource and its asynchronous cleanup', async () => {
  const scope = createDevShutdownScope()
  const acquisition = Promise.withResolvers<void>()
  const cleanup = Promise.withResolvers<void>()
  const close = vi.fn(() => cleanup.promise)
  const startup = scope.run('startup', async () => {
    await acquisition.promise
    scope.own(close)
  })
  scope.request('SIGINT')
  let finished = false
  void scope.done.then(() => {
    finished = true
  })
  acquisition.resolve()
  await startup
  await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  expect(finished).toBe(false)
  cleanup.resolve()
  await scope.done
  expect(finished).toBe(true)
})

it('drains every owner and reports startup plus cleanup failures before the exit gate opens', async () => {
  const reportError = vi.fn()
  const scope = createDevShutdownScope({ reportError })
  const startupFailure = new Error('startup failed')
  const closeFailure = new Error('restore failed')
  const closed = vi.fn()
  scope.own(closed)
  scope.own(() => {
    throw closeFailure
  })
  const result = scope.close(startupFailure)
  const rejected = expect(result).rejects.toMatchObject({ errors: [startupFailure, closeFailure] })
  await scope.done
  expect(closed).toHaveBeenCalledTimes(1)
  expect(process.exitCode).toBe(1)
  expect(reportError).toHaveBeenCalledTimes(1)
  await rejected
})

it('expires inherited operation privileges while preserving resource ownership', async () => {
  const scope = createDevShutdownScope()
  const release = Promise.withResolvers<void>()
  let callback!: Promise<void>
  await scope.run('startup', () => {
    expect(scope.isInternalOperation()).toBe(true)
    callback = release.promise.then(() => {
      expect(getDevShutdownScope()).toBe(scope)
      expect(scope.isInternalOperation()).toBe(false)
    })
  })
  release.resolve()
  await callback
  await scope.close()
})

it('keeps independent scopes separate and allows local cleanup during shutdown', async () => {
  const first = createDevShutdownScope()
  const second = createDevShutdownScope()
  const cleanup = vi.fn(async () => {
    expect(first.isInternalOperation()).toBe(true)
    expect(second.isInternalOperation()).toBe(false)
    await first.run('cleanup', async () => {})
  })
  first.own(cleanup)
  first.request()
  await first.done
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(second.stopping).toBe(false)
  await second.close()
})

it('rejects acquisitions from stale callbacks before they can open new resources', async () => {
  const scope = createDevShutdownScope()
  const create = vi.fn()
  await scope.close()
  await expect(scope.run('startup', create)).rejects.toThrow('shutdown completed')
  expect(create).not.toHaveBeenCalled()
})

it('waits for an external close even after its resource ownership has been retired', async () => {
  const scope = createDevShutdownScope()
  const release = Promise.withResolvers<void>()
  const cleanup = scope.run('cleanup', () => release.promise)
  const retire = scope.own(() => cleanup)
  retire()
  const finalCleanup = vi.fn()
  scope.own(finalCleanup)
  scope.request('SIGTERM')
  await Promise.resolve()
  expect(finalCleanup).not.toHaveBeenCalled()
  release.resolve()
  await scope.close()
  expect(finalCleanup).toHaveBeenCalledTimes(1)
})
