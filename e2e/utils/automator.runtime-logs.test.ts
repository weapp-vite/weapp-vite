import { EventEmitter } from 'node:events'
import process from 'node:process'
import { Automator } from '@weapp-vite/miniprogram-automator'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MiniProgram from '../../packages/miniprogram-automator/src/MiniProgram'
import { enhanceMiniProgramWithRuntimeLogs, launchAutomator, resetAutomatorRuntimeLogs } from './automator'
import { launchHeadlessAutomator } from './automator.headless'
import { resolveSelectedWechatDevtools } from './devtoolsSelection'
import { appendIdeReportEvent } from './ideWarningReport'
import { flushRuntimeConsoleSessions } from './runtimeConsoleSessions'

vi.mock('./automator.headless', () => ({ launchHeadlessAutomator: vi.fn() }))
vi.mock('./devtoolsSelection', () => ({
  resolveSelectedWechatDevtools: vi.fn(),
  assertSelectedWechatDevtoolsRuntime: vi.fn(),
}))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'e2e-apps/base' }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

function createSession() {
  return Object.assign(new EventEmitter(), { close: vi.fn(async () => {}) })
}

describe('automator runtime diagnostic lifecycle', () => {
  it('shares asynchronous disconnect completion after immediately detaching runtime logs', async () => {
    const barrier = Promise.withResolvers<void>()
    const session = Object.assign(createSession(), { disconnect: vi.fn(() => barrier.promise) })
    const rawDisconnect = session.disconnect
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    const first = session.disconnect()
    const second = session.disconnect()
    expect(second).toBe(first)
    expect(session.listenerCount('console')).toBe(0)
    const finished = vi.fn()
    void second.then(finished)
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    barrier.resolve()
    await Promise.all([first, second])
    expect(rawDisconnect).toHaveBeenCalledOnce()
    expect(finished).toHaveBeenCalledOnce()
  })

  it('still closes its project after the connection has already disconnected', async () => {
    const session = Object.assign(createSession(), { disconnect: vi.fn(), flushConsole: vi.fn(async () => {}) })
    const close = session.close
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    session.disconnect()
    await session.close()
    await session.close()
    expect(close).toHaveBeenCalledOnce()
    expect(session.flushConsole).not.toHaveBeenCalled()
  })

  it('retries failed project close after log collection has finished', async () => {
    const session = Object.assign(createSession(), { flushConsole: vi.fn(async () => {}) })
    const close = session.close.mockRejectedValueOnce(new Error('window remained open'))
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    await expect(session.close()).rejects.toThrow('window remained open')
    await session.close()
    expect(close).toHaveBeenCalledTimes(2)
    expect(session.flushConsole).toHaveBeenCalledOnce()
  })

  it('journals structured startup Errors before a failed subscription returns', async () => {
    const failure = new Error('Runtime enable failed')
    const connection = Object.assign(new EventEmitter(), {
      dispose: vi.fn(),
      send: vi.fn(async (_method: string, params: Record<string, unknown>) => {
        if (params.method === 'enable') {
          connection.emit('App.CDPEvent', {
            domain: 'Runtime',
            event: 'consoleAPICalled',
            params: {
              type: 'error',
              args: [{ type: 'object', className: 'Error', objectId: 'startup-error', description: 'Error' }],
            },
          })
          connection.emit('App.logAdded', { type: 'error', args: [{}] })
          throw failure
        }
        return { result: [{ name: 'message', enumerable: false, value: { value: 'Behavior construction failed' } }] }
      }),
    })
    const session = new MiniProgram(connection as any)
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    await expect(session.enableLog(1_000, { structured: true })).rejects.toBe(failure)
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(([entry]) => entry.level === 'error')).toEqual([
      [expect.objectContaining({ text: 'Error: Behavior construction failed' })],
    ])
    session.disconnect()
  })

  it('releases asynchronous console sessions even when close fails', async () => {
    const failure = new Error('close failed')
    const session = Object.assign(createSession(), { flushConsole: vi.fn(async () => {}) })
    session.close.mockRejectedValue(failure)
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    await expect(session.close()).rejects.toBe(failure)
    expect(session.flushConsole).toHaveBeenCalledTimes(1)
    await flushRuntimeConsoleSessions()
    expect(session.flushConsole).toHaveBeenCalledTimes(1)
    expect(session.listenerCount('console')).toBe(0)
  })

  it('still closes and releases the session when inspection fails, preserving both failures', async () => {
    const inspectionFailure = new Error('inspection failed')
    const closeFailure = new Error('close failed')
    const session = Object.assign(createSession(), {
      flushConsole: vi.fn(async () => {
        throw inspectionFailure
      }),
    })
    const rawClose = session.close
    rawClose.mockRejectedValue(closeFailure)
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    await expect(session.close()).rejects.toMatchObject({ errors: [inspectionFailure, closeFailure] })
    expect(rawClose).toHaveBeenCalledTimes(1)
    await flushRuntimeConsoleSessions()
    expect(session.flushConsole).toHaveBeenCalledTimes(1)
  })

  it('attaches SDK listeners passively before the single bounded startup subscription', async () => {
    vi.useFakeTimers()
    const connection = Object.assign(new EventEmitter(), {
      dispose: vi.fn(),
      send: vi.fn(async (_method: string, _params: unknown, _options: unknown) => ({})),
    })
    const session = new MiniProgram(connection as any)
    connection.send.mockImplementationOnce(async () => {
      connection.emit('App.logAdded', { type: 'error', args: ['subscription startup error'] })
      await new Promise(resolve => setTimeout(resolve, 250))
      return {}
    })
    try {
      enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
      expect(connection.send).not.toHaveBeenCalled()
      const enabling = session.enableLog(1_000)
      await vi.advanceTimersByTimeAsync(250)
      await enabling
      expect(connection.send.mock.calls).toEqual([
        ['App.enableLog', {}, { timeout: 1_000 }],
        ['App.CDPCommand', { domain: 'Runtime', method: 'enable', params: {} }, { timeout: 750 }],
      ])
      expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        text: 'subscription startup error',
      }))
      session.disconnect()
      expect(session.listenerCount('console')).toBe(0)
      expect(session.listenerCount('exception')).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('supports headless providers that expose only the passive on contract', async () => {
    const emitter = createSession()
    const session = {
      on: emitter.on.bind(emitter),
      removeListener: emitter.removeListener.bind(emitter),
      close: emitter.close,
    }
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    emitter.emit('console', { type: 'log', args: ['headless startup'] })
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ text: 'headless startup' }))
    await session.close()
    expect(emitter.listenerCount('console')).toBe(0)
  })

  it('attaches headless console collection and preserves exceptions until close', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const launchDevtools = vi.spyOn(Automator.prototype, 'launch').mockRejectedValue(new Error('unexpected DevTools launch'))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const session = createSession()
    vi.mocked(launchHeadlessAutomator).mockImplementation(async (options) => {
      await options.onSessionCreated?.(session as any)
      session.emit('console', { level: 'error', args: ['startup failure'] })
      return session as any
    })
    const launched = await launchAutomator({ bridgeProjectMode: 'direct', projectPath: 'e2e-apps/base' })
    expect(launchHeadlessAutomator).toHaveBeenCalledExactlyOnceWith({
      projectPath: 'e2e-apps/base',
      onSessionCreated: expect.any(Function),
    })
    expect(launchDevtools).not.toHaveBeenCalled()
    expect(resolveSelectedWechatDevtools).not.toHaveBeenCalled()
    session.emit('console', { type: 'error', args: ['headless failure'] })
    session.emit('exception', { exceptionDetails: { text: 'headless exception' } })
    await launched.close()
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: 'startup failure' }))
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: 'headless failure' }))
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'exception', text: 'headless exception' }))
    expect(session.listenerCount('console')).toBe(0)
    expect(session.listenerCount('exception')).toBe(0)
  })

  it('records a thrown headless bootstrap failure without changing the rejection', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const failure = new Error('bootstrap failed')
    vi.mocked(launchHeadlessAutomator).mockRejectedValue(failure)
    await expect(launchAutomator({ projectPath: 'e2e-apps/base' })).rejects.toBe(failure)
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ source: 'runtime', channel: 'launch', level: 'error', text: expect.stringContaining('bootstrap failed') }))
  })

  it('forwards declared compiled templates unchanged to the headless launch', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const compiledTemplatePaths = ['pages/index/index.wxml', 'components/card/index.wxml'] as const
    const configureHeadlessSession = vi.fn()
    const session = createSession()
    vi.mocked(launchHeadlessAutomator).mockResolvedValue(session as any)
    const launched = await launchAutomator({
      projectPath: 'e2e-apps/base',
      configureHeadlessSession,
      headlessCompiledTemplatePaths: compiledTemplatePaths,
    })
    expect(launchHeadlessAutomator).toHaveBeenCalledExactlyOnceWith({
      projectPath: 'e2e-apps/base',
      configureSession: configureHeadlessSession,
      compiledTemplatePaths,
      onSessionCreated: expect.any(Function),
    })
    expect(vi.mocked(launchHeadlessAutomator).mock.calls[0]![0].compiledTemplatePaths).toBe(compiledTemplatePaths)
    await launched.close()
  })

  it('retains startup journal entries after in-memory reset and does not duplicate listeners', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const session = createSession()
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    session.emit('console', { type: 'error', args: ['startup failure'] })
    resetAutomatorRuntimeLogs(session)
    expect(session.listenerCount('console')).toBe(1)
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(call => call[0].text === 'startup failure')).toHaveLength(1)
    await session.close()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(call => call[0].text === 'startup failure')).toHaveLength(1)
  })

  it('retains exceptions whose protocol text is empty', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const session = createSession()
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    session.emit('exception', { exceptionDetails: { text: '' } })
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
      level: 'exception',
      text: '{"exceptionDetails":{"text":""}}',
    }))
    await session.close()
  })

  it('disposes runtime subscriptions once when close also disconnects', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const session = Object.assign(createSession(), { disconnect: vi.fn() })
    const disconnect = session.disconnect
    session.close.mockImplementation(async () => session.disconnect())
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    await session.close()
    await session.close()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(session.listenerCount('console')).toBe(0)
    expect(session.listenerCount('exception')).toBe(0)
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(([entry]) => entry.kind === 'stats')).toHaveLength(1)
  })
})
