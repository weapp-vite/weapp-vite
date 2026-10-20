import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTemplateDevOpenRunner } from '../e2e/ide/templateDevOpenSession'
import { runCleanupSteps } from '../e2e/utils/cleanupSteps'

function createCase(name = 'template-a') {
  return {
    name,
    open: vi.fn(async () => ({ route: '/pages/index/index' })),
    run: vi.fn<(_session: { route: string }) => Promise<void>>().mockResolvedValue(undefined),
    cleanup: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('template dev:open single-session execution', () => {
  it('opens each template once and completes cleanup before opening the next', async () => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const events: string[] = []
    first.open.mockImplementation(async () => {
      events.push('open-a')
      return { route: '/pages/index/index' }
    })
    first.run.mockImplementation(async () => {
      events.push('run-a')
    })
    first.cleanup.mockImplementation(async () => {
      events.push('cleanup-a')
    })
    next.open.mockImplementation(async () => {
      events.push('open-b')
      return { route: '/pages/index/index' }
    })

    await execute(first)
    await execute(next)

    expect(first.open).toHaveBeenCalledOnce()
    expect(first.run).toHaveBeenCalledWith(await first.open.mock.results[0]!.value)
    expect(first.cleanup).toHaveBeenCalledOnce()
    expect(next.open).toHaveBeenCalledOnce()
    expect(events).toEqual(['open-a', 'run-a', 'cleanup-a', 'open-b'])
  })

  it('preserves the first startup failure without reopening and blocks subsequent templates', async () => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const startupError = new Error('simulator initialization failed')
    first.open.mockRejectedValue(startupError)

    await expect(execute(first)).rejects.toBe(startupError)
    expect(first.open).toHaveBeenCalledOnce()
    expect(first.run).not.toHaveBeenCalled()
    expect(first.cleanup).toHaveBeenCalledOnce()

    await expect(execute(next)).rejects.toMatchObject({ cause: startupError })
    expect(next.open).not.toHaveBeenCalled()
    expect(next.run).not.toHaveBeenCalled()
    expect(next.cleanup).not.toHaveBeenCalled()
  })

  it('does not reopen after a runtime protocol failure and refuses the next cold start', async () => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const protocolError = new Error('DevTools did not respond to protocol method App.getCurrentPage')
    first.run.mockRejectedValue(protocolError)

    await expect(execute(first)).rejects.toBe(protocolError)
    await expect(execute(next)).rejects.toMatchObject({ cause: protocolError })

    expect(first.open).toHaveBeenCalledOnce()
    expect(first.run).toHaveBeenCalledOnce()
    expect(first.cleanup).toHaveBeenCalledOnce()
    expect(next.open).not.toHaveBeenCalled()
  })

  it('blocks the next template after an assertion failure even when cleanup succeeds', async () => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const checkpointError = new Error('opened DOM checkpoint did not match')
    first.run.mockRejectedValue(checkpointError)

    await expect(execute(first)).rejects.toBe(checkpointError)
    await expect(execute(next)).rejects.toMatchObject({ cause: checkpointError })

    expect(first.open).toHaveBeenCalledOnce()
    expect(first.run).toHaveBeenCalledOnce()
    expect(first.cleanup).toHaveBeenCalledOnce()
    expect(next.open).not.toHaveBeenCalled()
  })

  it('attempts every teardown phase and retains startup and cleanup failures together', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const startupError = new Error('opened automator unavailable')
    const stopError = new Error('dev process stop failed')
    const closeError = new Error('owned window close unconfirmed')
    const detach = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const disconnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const stop = vi.fn<() => Promise<void>>().mockRejectedValue(stopError)
    const close = vi.fn<() => Promise<void>>().mockRejectedValue(closeError)
    const release = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    first.open.mockRejectedValue(startupError)
    first.cleanup.mockImplementation(async () => await runCleanupSteps([
      { label: 'detach runtime logs', run: detach },
      { label: 'disconnect automator', run: disconnect },
      { label: 'stop dev process', run: stop },
      { label: 'close owned window', run: close },
      { label: 'release IDE resources', run: release },
    ]))

    const failure: unknown = await execute(first).catch(error => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure).toMatchObject({
      cause: startupError,
      errors: [startupError, {
        errors: [{ cause: stopError }, { cause: closeError }],
      }],
    })
    for (const cleanup of [detach, disconnect, stop, close, release]) {
      expect(cleanup).toHaveBeenCalledOnce()
    }
    expect(first.open).toHaveBeenCalledOnce()
    await expect(execute(next)).rejects.toMatchObject({ cause: startupError })
    expect(next.open).not.toHaveBeenCalled()
  })

  it('blocks the next template after cleanup fails even when runtime assertions succeeded', async () => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const next = createCase('template-b')
    const cleanupError = new Error('owned resources remain unconfirmed')
    first.cleanup.mockRejectedValue(cleanupError)

    await expect(execute(first)).rejects.toBe(cleanupError)
    await expect(execute(next)).rejects.toMatchObject({ cause: cleanupError })

    expect(first.run).toHaveBeenCalledOnce()
    expect(first.cleanup).toHaveBeenCalledOnce()
    expect(next.open).not.toHaveBeenCalled()
  })

  it.each([undefined, 'non-Error startup failure', 0])('retains non-Error rejection and cleanup failure: %s', async (startupError) => {
    const execute = createTemplateDevOpenRunner()
    const first = createCase()
    const cleanupError = new Error('cleanup failed')
    first.open.mockRejectedValue(startupError)
    first.cleanup.mockRejectedValue(cleanupError)

    await expect(execute(first)).rejects.toMatchObject({
      cause: startupError,
      errors: [startupError, cleanupError],
    })
    expect(first.open).toHaveBeenCalledOnce()
    expect(first.cleanup).toHaveBeenCalledOnce()
  })
})
