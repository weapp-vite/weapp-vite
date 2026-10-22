import type { Connection } from '@weapp-vite/miniprogram-automator'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableReconnectedAutomatorRuntimeLogs } from './automator'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'e2e-apps/base' }))

const sessions: MiniProgram[] = []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  await Promise.all(sessions.splice(0).map(session => session.disconnect()))
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function fixture(timeout = 60_000) {
  const connection = Object.assign(new EventEmitter(), {
    dispose: vi.fn(async () => {}),
    send: vi.fn<(method: string, params?: Record<string, unknown>, options?: { timeout?: number }) => Promise<Record<string, unknown>>>(async () => ({})),
  })
  const session = new MiniProgram(connection as unknown as Connection)
  sessions.push(session)
  const lifecycle = new AutomatorLaunchLifecycle(timeout, 'reconnect runtime logs')
  const assertClean = vi.fn()
  return { connection, session, lifecycle, assertClean }
}

function after(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

describe('reconnected automator runtime log subscription', () => {
  it.each(['App.CDPEnable', 'App.CDPCommand'])('keeps the socket and listeners through a ten-second %s host response timeout', async (failedMethod) => {
    const { connection, session, lifecycle, assertClean } = fixture()
    const failure = new Error('timeout waiting for automator response')
    let rejected = false
    connection.send.mockImplementation(async (method) => {
      if (!rejected && method === failedMethod) {
        rejected = true
        await after(10_000)
        throw failure
      }
      return {}
    })
    const pending = enableReconnectedAutomatorRuntimeLogs(session, 'e2e-apps/base', lifecycle, assertClean)
    const assertion = expect(pending).resolves.toBeUndefined()
    await Promise.all([assertion, vi.advanceTimersByTimeAsync(10_250)])
    expect(connection.send.mock.calls.map(([method]) => method)).toEqual(failedMethod === 'App.CDPEnable'
      ? ['App.CDPEnable', 'App.CDPEnable', 'App.CDPCommand']
      : ['App.CDPEnable', 'App.CDPCommand', 'App.CDPEnable', 'App.CDPCommand'])
    expect(connection.send.mock.calls.every(([, , options]) => (options?.timeout ?? Infinity) <= 15_000)).toBe(true)
    expect(connection.dispose).not.toHaveBeenCalled()
    expect(session.listenerCount('console')).toBe(1)
    expect(session.listenerCount('exception')).toBe(1)
    expect(assertClean).toHaveBeenCalledTimes(4)
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('timeout waiting for automator response'))
    connection.emit('App.CDPEvent', {
      domain: 'Runtime',
      event: 'consoleAPICalled',
      params: { type: 'log', args: [{ type: 'string', value: 'reloaded runtime log' }] },
    })
    await session.flushConsole()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(([entry]) => entry.text === 'reloaded runtime log')).toHaveLength(1)
  })

  it.each(['Connection closed, check if wechat web devTools is still running', 'business runtime failure', 'CDP transport unsupported'])('preserves %s without another subscription', async (message) => {
    const { connection, session, lifecycle, assertClean } = fixture()
    const failure = new Error(message)
    connection.send.mockRejectedValueOnce(failure)
    await expect(enableReconnectedAutomatorRuntimeLogs(session, 'e2e-apps/base', lifecycle, assertClean)).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(connection.send).toHaveBeenCalledOnce()
    expect(connection.dispose).not.toHaveBeenCalled()
  })

  it('preserves a compiler diagnostic observed after the first host timeout', async () => {
    const { connection, session, lifecycle, assertClean } = fixture()
    const failure = new Error('compile failed: SyntaxError')
    let compileFailed = false
    connection.send.mockImplementationOnce(async () => {
      await after(10_000)
      compileFailed = true
      throw new Error('timeout waiting for automator response')
    })
    assertClean.mockImplementation(() => {
      if (compileFailed) {
        throw failure
      }
    })
    const pending = enableReconnectedAutomatorRuntimeLogs(session, 'e2e-apps/base', lifecycle, assertClean)
    const assertion = expect(pending).rejects.toBe(failure)
    await Promise.all([assertion, vi.advanceTimersByTimeAsync(60_000)])
    expect(connection.send).toHaveBeenCalledOnce()
  })

  it('stops at the shared deadline and retains the original host response error', async () => {
    const { connection, session, lifecycle, assertClean } = fixture(16_000)
    const failure = new Error('timeout waiting for automator response')
    connection.send.mockImplementation(async (_method, _params, options) => {
      await after(options!.timeout!)
      throw failure
    })
    const pending = enableReconnectedAutomatorRuntimeLogs(session, 'e2e-apps/base', lifecycle, assertClean)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE', attempts: 2, cause: failure })
    await Promise.all([assertion, vi.advanceTimersByTimeAsync(16_000)])
    expect(connection.send.mock.calls.map(([, , options]) => options?.timeout)).toEqual([15_000, 750])
  })

  it('cancels the pending subscription without retrying after its late response', async () => {
    const { connection, session, lifecycle, assertClean } = fixture()
    const canceled = new Error('reconnect canceled')
    connection.send.mockImplementationOnce(async () => {
      await after(10_000)
      throw new Error('timeout waiting for automator response')
    })
    const pending = enableReconnectedAutomatorRuntimeLogs(session, 'e2e-apps/base', lifecycle, assertClean)
    const assertion = expect(pending).rejects.toBe(canceled)
    await Promise.all([
      assertion,
      vi.advanceTimersByTimeAsync(1_000).then(() => lifecycle.controller.abort(canceled)),
    ])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(connection.send).toHaveBeenCalledOnce()
    expect(connection.dispose).not.toHaveBeenCalled()
  })
})
