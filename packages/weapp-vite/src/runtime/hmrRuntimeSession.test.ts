import { describe, expect, it, vi } from 'vitest'
import { logger } from '../context/shared'
import { resolveHmrRuntimeDecision } from './hmrRuntime'
import { attachHmrRuntimeSession, createHmrRuntimeSession, getHmrRuntimeSession } from './hmrRuntimeSession'

describe('HMR runtime command session', () => {
  it.each([
    ['auto', 'startup'],
    ['stateful-experimental', 'startup'],
    ['auto', 'runtime'],
    ['stateful-experimental', 'runtime'],
  ] as const)('records requested %s, actual mode and reason for %s capability fallback', async (configured, stage) => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {})
    try {
      const session = createHmrRuntimeSession()
      session.resolve(resolveHmrRuntimeDecision({ platform: 'weapp', configured, compileHotReLoad: true }))
      const restart = vi.fn(async () => session.markClassic())
      if (stage === 'runtime') {
        session.bindRequest(restart)
      }
      const reason = { code: 'compiler-provider', message: 'provider has no prepare' } as const
      session.requestClassic(reason)
      expect(warn).toHaveBeenCalledOnce()
      const fallbackPrefix = '[weapp-vite] HMR fallback '
      expect(warn.mock.calls[0]?.[0]).toEqual(expect.stringContaining(fallbackPrefix))
      const fallbackLog: unknown = JSON.parse(String(warn.mock.calls[0]?.[0]).slice(fallbackPrefix.length))
      expect(fallbackLog).toEqual({
        from: 'stateful-experimental',
        to: 'classic',
        reason: reason.code,
        message: reason.message,
        requested: configured,
        actual: 'classic',
        phase: 'switching',
      })
      expect(info).not.toHaveBeenCalled()
      expect(restart).not.toHaveBeenCalled()
      // 配置重载和后续不支持的更新不能覆写首次降级的请求模式与原因。
      session.resolve({ configured: 'classic', runtime: 'classic', reason: 'explicit' })
      session.requestClassic({ code: 'config-json', message: 'later update' })
      if (stage === 'startup') {
        session.bindRequest(restart)
      }
      await session.whenSettled()
      expect(warn).toHaveBeenCalledOnce()
      expect(restart).toHaveBeenCalledOnce()
      expect(info).toHaveBeenCalledOnce()
      const readyPrefix = '[weapp-vite] HMR classic ready '
      expect(info.mock.calls[0]?.[0]).toEqual(expect.stringContaining(readyPrefix))
      const readyLog: unknown = JSON.parse(String(info.mock.calls[0]?.[0]).slice(readyPrefix.length))
      expect(readyLog).toEqual({ reason: reason.code, requested: configured, actual: 'classic', phase: 'classic' })
    }
    finally {
      warn.mockRestore()
      info.mockRestore()
    }
  })

  it.each(['auto', 'stateful-experimental'] as const)('keeps %s classic after a single capability fallback across configuration restarts', async (configured) => {
    const session = createHmrRuntimeSession()
    const restart = vi.fn(async () => session.markClassic())
    session.bindRequest(restart)
    session.requestClassic({ code: 'compiler-provider', message: 'provider has no prepare' })
    expect(session.phase).toBe('switching')
    expect(restart).not.toHaveBeenCalled()
    expect(session.resolve({ configured, reason: 'explicit', runtime: 'stateful-experimental' })).toEqual({ configured, reason: 'capability-fallback', runtime: 'classic' })
    session.requestClassic({ code: 'config-json', message: 'later update' })
    await session.whenSettled()
    expect(session.phase).toBe('classic')
    expect(session.fallback?.code).toBe('compiler-provider')
    expect(restart).toHaveBeenCalledOnce()
    const replacementContext = {}
    attachHmrRuntimeSession(replacementContext, session)
    expect(getHmrRuntimeSession(replacementContext)).toBe(session)
    expect(getHmrRuntimeSession(replacementContext).resolve({ configured, reason: 'explicit', runtime: 'stateful-experimental' }).runtime).toBe('classic')
    session.bindRequest(restart)
    await Promise.resolve()
    expect(restart).toHaveBeenCalledOnce()
  })

  it('binds a request made before the host exists and ignores cleanup from an older binding', async () => {
    const session = createHmrRuntimeSession()
    const previous = vi.fn()
    const next = vi.fn(async () => session.markClassic())
    session.requestClassic({ code: 'runtime-contract', message: 'missing runtime' })
    const release = session.bindRequest(previous)
    session.bindRequest(next)
    release()
    await session.whenSettled()
    expect(previous).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it('retains the first host error and never loops restart after failure', async () => {
    const session = createHmrRuntimeSession()
    const failure = new Error('host shutdown failed')
    const restart = vi.fn(async () => {
      throw failure
    })
    session.bindRequest(restart)
    session.requestClassic({ code: 'config-json', message: 'config changed' })
    await expect(session.whenSettled()).rejects.toBe(failure)
    session.requestClassic({ code: 'entry-topology', message: 'new page' })
    session.bindRequest(restart)
    await expect(session.whenSettled()).rejects.toBe(failure)
    expect(session.phase).toBe('switching')
    expect(restart).toHaveBeenCalledOnce()
  })

  it('waits for the first successful classic publication after host restart has returned', async () => {
    const session = createHmrRuntimeSession()
    const restarted = Promise.withResolvers<void>()
    session.bindRequest(async () => restarted.resolve())
    session.requestClassic({ code: 'config-json', message: 'config changed' })
    await restarted.promise
    await Promise.resolve()
    expect(session.phase).toBe('switching')
    session.markClassic()
    await session.whenSettled()
    expect(session.phase).toBe('classic')
  })

  it('releases only the context association it still owns', () => {
    const context = {}
    const oldSession = createHmrRuntimeSession()
    const nextSession = createHmrRuntimeSession()
    const releaseOld = attachHmrRuntimeSession(context, oldSession)
    const releaseNext = attachHmrRuntimeSession(context, nextSession)
    releaseOld()
    expect(getHmrRuntimeSession(context)).toBe(nextSession)
    releaseNext()
    expect(getHmrRuntimeSession(context)).not.toBe(nextSession)
    const releaseFirst = attachHmrRuntimeSession(context, nextSession)
    const releaseSecond = attachHmrRuntimeSession(context, nextSession)
    releaseFirst()
    expect(getHmrRuntimeSession(context)).toBe(nextSession)
    releaseSecond()
    expect(getHmrRuntimeSession(context)).not.toBe(nextSession)
  })
})
