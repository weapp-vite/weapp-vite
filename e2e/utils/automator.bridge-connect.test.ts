import { Automator } from '@weapp-vite/miniprogram-automator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { launchAutomatorViaCliBridge } from './automator'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('automator bridge handshake readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    execaMock.mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ wsEndpoint: 'ws://localhost' }) })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function handshakeTimeout(method = 'Tool.getInfo') {
    return Object.assign(new Error(`DevTools did not respond to protocol method ${method}`), {
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method,
    })
  }

  function launch(budget = 10_000) {
    const lifecycle = new AutomatorLaunchLifecycle(budget, 'bridge launch')
    return lifecycle.run(scope => launchAutomatorViaCliBridge({ projectPath: 'fixture' }, 'fixture', scope))
  }

  it('reconnects after a cold Tool.getInfo timeout within the original launch budget', async () => {
    const session = { close: vi.fn(), disconnect: vi.fn() }
    const connect = vi.spyOn(Automator.prototype, 'connect')
      .mockImplementationOnce(options => new Promise((_resolve, reject) => {
        setTimeout(() => reject(handshakeTimeout()), options.timeout)
      }))
      .mockResolvedValueOnce(session as any)
    const result = expect(launch()).resolves.toBe(session)
    await vi.runAllTimersAsync()
    await result
    expect(connect).toHaveBeenCalledTimes(2)
    expect(connect.mock.calls.map(([options]) => options.timeout)).toEqual([4_000, 4_000])
    expect(session.close).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([handshakeTimeout('App.getCurrentPage'), new Error('unsupported protocol version')])('does not retry unrelated errors: %s', async (failure) => {
    const connect = vi.spyOn(Automator.prototype, 'connect').mockRejectedValue(failure)
    const result = expect(launch()).rejects.toBe(failure)
    await vi.runAllTimersAsync()
    await result
    expect(connect).toHaveBeenCalledOnce()
  })

  it('exhausts the original budget when the handshake never becomes ready', async () => {
    const connect = vi.spyOn(Automator.prototype, 'connect').mockImplementation(options => new Promise((_resolve, reject) => {
      setTimeout(() => reject(handshakeTimeout()), options.timeout)
    }))
    const result = expect(launch(5_000)).rejects.toThrow('Timeout in bridge launch after 5000ms')
    await vi.runAllTimersAsync()
    await result
    expect(connect.mock.calls.map(([options]) => options.timeout)).toEqual([4_000, 600])
    expect(vi.getTimerCount()).toBe(0)
  })
})
