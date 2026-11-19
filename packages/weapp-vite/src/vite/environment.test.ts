import type { Plugin } from 'vite'
import type { WeappBuildSession } from './session'
import { describe, expect, it, vi } from 'vitest'
import { createSessionEnvironmentPlugin } from './environment'

type Phase = 'options' | 'buildStart' | 'closeWatcher'

function fixture(watchMode = false, serve = false) {
  const session = {
    context: { configService: { weappViteConfig: {} } },
    validateEntries: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    closeHostGeneration: vi.fn(async (_reason: 'restart' | 'close') => {}),
  }
  const context = {
    meta: { watchMode },
    addWatchFile: vi.fn<(file: string) => void>(),
  }
  const plugin = createSessionEnvironmentPlugin(session as unknown as WeappBuildSession, serve)
  const run = async (phase: Phase, ...args: unknown[]) => {
    const hook: Plugin[Phase] = plugin[phase]
    const handler = typeof hook === 'function' ? hook : hook?.handler
    if (!handler) {
      throw new Error(`Missing environment hook: ${phase}`)
    }
    return await (handler as (this: typeof context, ...args: unknown[]) => unknown).apply(context, args)
  }
  return { session, context, run }
}

describe('standard Vite environment lifecycle', () => {
  it.each([false, true])('leaves terminal IDE restoration to the serving host (serve=%s)', async (serve) => {
    const { session, run } = fixture(true, serve)
    await run('closeWatcher')
    if (serve) {
      expect(session.closeHostGeneration).toHaveBeenCalledExactlyOnceWith('close')
      expect(session.close).not.toHaveBeenCalled()
    }
    else {
      expect(session.close).toHaveBeenCalledOnce()
      expect(session.closeHostGeneration).not.toHaveBeenCalled()
    }
  })

  it('waits for watch entry validation before scanning', async () => {
    const { session, run } = fixture(true)
    await run('options')
    const validated = Promise.withResolvers<void>()
    session.validateEntries.mockReturnValueOnce(validated.promise)
    let started = false
    const starting = run('buildStart').then(() => {
      started = true
    })
    expect(started).toBe(false)
    validated.resolve()
    await starting
    expect(session.validateEntries).toHaveBeenCalledTimes(2)
  })

  it('preserves a watch validation failure without starting dependency work or closing the session', async () => {
    const { session, context, run } = fixture(true)
    const failure = new Error('invalid app entry')
    session.validateEntries.mockRejectedValueOnce(failure)
    await expect(run('buildStart')).rejects.toBe(failure)
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(session.close).not.toHaveBeenCalled()
  })

  it('leaves dependency preparation and publication to the serving host', async () => {
    const { session, context, run } = fixture(true, true)
    await run('options')
    await run('buildStart')
    expect(session.validateEntries).not.toHaveBeenCalled()
    expect(context.addWatchFile).not.toHaveBeenCalled()
  })
})
