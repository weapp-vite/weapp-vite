import { describe, expect, it, vi } from 'vitest'
import { bindUniAppCompatibilitySession, cacheUniAppCompatibilitySource, getUniAppCompatibilitySessionStats } from '../plugins/uniApp/cache'
import { CompilerSession } from '../runtime/compilerSession'
import { attachHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { WeappBuildSession } from './session'

function seedCache(owner: WeappBuildSession) {
  const config = {
    absoluteSrcRoot: 'src',
    platform: 'weapp' as const,
    weappViteConfig: { uniApp: { include: [] } },
  }
  bindUniAppCompatibilitySession(config, owner.hmrRuntimeSession)
  const transform = vi.fn(() => 'prepared')
  const read = () => cacheUniAppCompatibilitySource(config, 'raw', 'src/Page.vue', undefined, transform)
  expect(read()).toBe('prepared')
  return { read, transform }
}

describe('uni-app cache terminal ownership', () => {
  it('releases cached strings when the terminal owner closes', async () => {
    const owner = new WeappBuildSession()
    seedCache(owner)
    expect(getUniAppCompatibilitySessionStats(owner.hmrRuntimeSession).entries).toBe(1)
    await owner.close()
    expect(getUniAppCompatibilitySessionStats(owner.hmrRuntimeSession).entries).toBe(0)
  })

  it('retains pure results through restart, stale owners and borrowed child teardown', async () => {
    const previous = new WeappBuildSession()
    const { read, transform } = seedCache(previous)
    await previous.close('restart')
    expect(read()).toBe('prepared')
    const current = new WeappBuildSession(previous.hmrRuntimeSession)
    const borrowed = new CompilerSession()
    borrowed.onClose(attachHmrRuntimeSession(borrowed.context, current.hmrRuntimeSession, { borrowed: true }))
    try {
      await borrowed.close()
      await previous.releaseClassicIdeConfig()
      expect(read()).toBe('prepared')
      expect(transform).toHaveBeenCalledOnce()
      expect(getUniAppCompatibilitySessionStats(current.hmrRuntimeSession).entries).toBe(1)
    }
    finally {
      await borrowed.close()
      await current.close()
    }
    expect(getUniAppCompatibilitySessionStats(current.hmrRuntimeSession).entries).toBe(0)
  })

  it('frees cache memory while preserving a classic owner cleanup failure', async () => {
    const owner = new WeappBuildSession()
    seedCache(owner)
    const failure = new Error('classic cleanup failed')
    vi.spyOn(owner.hmrRuntimeSession.classicIdeConfig, 'close').mockRejectedValueOnce(failure)
    await expect(owner.close()).rejects.toBe(failure)
    expect(getUniAppCompatibilitySessionStats(owner.hmrRuntimeSession).entries).toBe(0)
  })

  it.each(['close', 'releaseClassicIdeConfig'] as const)('frees pure results when %s fails before classic owner cleanup', async (method) => {
    const owner = new WeappBuildSession()
    seedCache(owner)
    const first = new Error('first owned cleanup failed')
    const second = new Error('second owned cleanup failed')
    owner.onClose(() => {
      throw first
    })
    owner.onClose(() => {
      throw second
    })
    const classicClose = vi.spyOn(owner.hmrRuntimeSession.classicIdeConfig, 'close')
    const failure: unknown = await owner[method]().catch(error => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure).toMatchObject({ errors: [second, first] })
    expect(owner.state).toBe('closed')
    expect(getUniAppCompatibilitySessionStats(owner.hmrRuntimeSession).entries).toBe(0)
    expect(classicClose).not.toHaveBeenCalled()
    await expect(owner[method]()).rejects.toBe(failure)
  })

  it('releases the terminal cache when closing the current host generation rejects', async () => {
    const previous = new WeappBuildSession()
    const current = new WeappBuildSession(previous.hmrRuntimeSession)
    seedCache(current)
    const cause = new Error('current host cleanup failed')
    current.onClose(() => {
      throw cause
    })
    const classicClose = vi.spyOn(current.hmrRuntimeSession.classicIdeConfig, 'close')
    try {
      const failure: unknown = await previous.releaseHostClassicIdeConfig().catch(error => error)
      expect(failure).toBeInstanceOf(AggregateError)
      expect(failure).toMatchObject({ errors: [cause] })
      expect(current.state).toBe('closed')
      expect(getUniAppCompatibilitySessionStats(current.hmrRuntimeSession).entries).toBe(0)
      expect(classicClose).not.toHaveBeenCalled()
      await expect(previous.releaseHostClassicIdeConfig()).rejects.toBe(failure)
    }
    finally {
      await previous.close('restart')
    }
  })

  it('retains shared cache when restart or a stale owner cleanup fails', async () => {
    const previous = new WeappBuildSession()
    const { read, transform } = seedCache(previous)
    const cause = new Error('restart owned cleanup failed')
    previous.onClose(() => {
      throw cause
    })
    const failure: unknown = await previous.close('restart').catch(error => error)
    expect(failure).toMatchObject({ errors: [cause] })
    expect(read()).toBe('prepared')
    expect(transform).toHaveBeenCalledOnce()
    const current = new WeappBuildSession(previous.hmrRuntimeSession)
    try {
      await expect(previous.releaseClassicIdeConfig()).rejects.toBe(failure)
      await expect(previous.close()).rejects.toBe(failure)
      expect(read()).toBe('prepared')
      expect(transform).toHaveBeenCalledOnce()
    }
    finally {
      await current.close()
    }
  })

  it.each(['close', 'releaseClassicIdeConfig', 'releaseHostClassicIdeConfig'] as const)('preserves a replacement owner cache when %s rejects during ownership handoff', async (method) => {
    const previous = new WeappBuildSession()
    const pending = Promise.withResolvers<void>()
    const cause = new Error('previous generation cleanup failed')
    previous.onClose(async () => {
      await pending.promise
      throw cause
    })
    const closing = previous[method]().catch(error => error)
    const current = new WeappBuildSession(previous.hmrRuntimeSession)
    const { read, transform } = seedCache(current)
    try {
      pending.resolve()
      const failure: unknown = await closing
      expect(failure).toMatchObject({ errors: [cause] })
      expect(read()).toBe('prepared')
      expect(transform).toHaveBeenCalledOnce()
      expect(getUniAppCompatibilitySessionStats(current.hmrRuntimeSession).entries).toBe(1)
    }
    finally {
      pending.resolve()
      await closing
      await current.close()
    }
  })

  it('retains the parent cache when a borrowed child cleanup rejects', async () => {
    const owner = new WeappBuildSession()
    const { read, transform } = seedCache(owner)
    const borrowed = new CompilerSession()
    borrowed.onClose(attachHmrRuntimeSession(borrowed.context, owner.hmrRuntimeSession, { borrowed: true }))
    const cause = new Error('borrowed child cleanup failed')
    borrowed.onClose(() => {
      throw cause
    })
    try {
      await expect(borrowed.close()).rejects.toMatchObject({ errors: [cause] })
      expect(read()).toBe('prepared')
      expect(transform).toHaveBeenCalledOnce()
    }
    finally {
      await owner.close()
    }
  })

  it('closes the current host generation before freeing the terminal cache on failure', async () => {
    const previous = new WeappBuildSession()
    const current = new WeappBuildSession(previous.hmrRuntimeSession)
    seedCache(current)
    const close = vi.spyOn(current, 'closeHostGeneration')
    const failure = new Error('host classic cleanup failed')
    vi.spyOn(current.hmrRuntimeSession.classicIdeConfig, 'close').mockRejectedValueOnce(failure)
    try {
      await expect(previous.releaseHostClassicIdeConfig()).rejects.toBe(failure)
      expect(close).toHaveBeenCalledWith('close')
      expect(current.state).toBe('closed')
      expect(getUniAppCompatibilitySessionStats(current.hmrRuntimeSession).entries).toBe(0)
    }
    finally {
      await previous.close('restart')
      await current.close('restart')
    }
  })
})
