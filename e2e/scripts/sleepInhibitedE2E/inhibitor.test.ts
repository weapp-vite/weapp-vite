import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startSleepInhibitor } from './inhibitor'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.spawn }))

function fixture() {
  const completion = Promise.withResolvers<{ exitCode: number | undefined, signal: string | undefined }>()
  const nodeChildProcess = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null as string | null })
  const kill = vi.fn()
  const child = Object.assign(completion.promise, { nodeChildProcess, kill })
  return {
    child,
    complete(signal: string | null = 'SIGTERM') {
      nodeChildProcess.signalCode = signal ?? null
      nodeChildProcess.exitCode = signal ? null : 0
      completion.resolve({ exitCode: signal ? undefined : 0, signal: signal ?? undefined })
    },
    fail(error: Error) { completion.reject(error) },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('owned sleep inhibitor', () => {
  it('waits for the exact isolated sidecar to stop and shares concurrent close calls', async () => {
    const worker = fixture()
    mocks.spawn.mockReturnValue(worker.child)
    const starting = startSleepInhibitor('darwin')
    worker.child.nodeChildProcess.emit('spawn')
    const inhibitor = (await starting)!
    expect(mocks.spawn).toHaveBeenCalledExactlyOnceWith('caffeinate', ['-dimsu', '-w', String(process.pid)], expect.objectContaining({
      detached: true,
      cleanup: false,
      killDescendants: false,
      forceKillAfterDelay: 1_000,
    }))
    const close = inhibitor.close()
    expect(inhibitor.close()).toBe(close)
    expect(worker.child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
    let finished = false
    void close.then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    worker.complete()
    await close
    expect(await inhibitor.failure).toBeUndefined()
  })

  it('reports a premature exit before cleanup so the same suite can be cancelled', async () => {
    const worker = fixture()
    mocks.spawn.mockReturnValue(worker.child)
    const starting = startSleepInhibitor('darwin')
    worker.child.nodeChildProcess.emit('spawn')
    const inhibitor = (await starting)!
    worker.complete(null)
    const failure = await inhibitor.failure
    expect(failure?.message).toContain('before its owned cleanup')
    await expect(inhibitor.close()).rejects.toBe(failure)
  })

  it('preserves a spawn failure without creating an inhibitor handle', async () => {
    const worker = fixture()
    mocks.spawn.mockReturnValue(worker.child)
    const failure = new Error('spawn unavailable')
    const starting = startSleepInhibitor('darwin')
    worker.child.nodeChildProcess.emit('error', failure)
    worker.fail(failure)
    await expect(starting).rejects.toBe(failure)
    expect(worker.child.kill).not.toHaveBeenCalled()
  })

  it.each(['linux', 'win32'] as const)('does not launch a sidecar on %s', async (platform) => {
    expect(await startSleepInhibitor(platform)).toBeUndefined()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })
})
