import { Automator } from '@weapp-vite/miniprogram-automator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { launchAutomatorViaCliBridge } from './automator'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'

const { execaMock, createJournal, cleanupJournal, closeProject } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  createJournal: vi.fn(async () => 'task-journal/children/attempt-journal'),
  cleanupJournal: vi.fn(async () => {}),
  closeProject: vi.fn(async () => {}),
}))
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))
vi.mock('./devtoolsProcessOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./devtoolsProcessOwnership')>()
  return { ...actual, createDevtoolsProjectJournal: createJournal }
})
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>()
  return { ...actual, cleanupManagedWechatProjects: cleanupJournal, closeManagedWechatProject: closeProject }
})

describe('automator bridge handshake readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', '')
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    execaMock.mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ wsEndpoint: 'ws://localhost' }) })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()
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

  it('reports the actual bridge endpoint before a failed handshake can lose it', async () => {
    execaMock.mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9415' }) })
    const onSessionMetadata = vi.fn(async () => {})
    vi.spyOn(Automator.prototype, 'connect').mockImplementation(async () => {
      expect(onSessionMetadata).toHaveBeenCalledExactlyOnceWith({ projectPath: 'owned-snapshot', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415 })
      throw new Error('unsupported protocol version')
    })
    const lifecycle = new AutomatorLaunchLifecycle(10_000, 'bridge launch')
    await expect(lifecycle.run(scope => launchAutomatorViaCliBridge({ projectPath: 'owned-snapshot' }, 'fixture', scope, undefined, onSessionMetadata))).rejects.toThrow('unsupported protocol version')
  })

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

  it.each(['', 'truncated receipt'])('cleans the attempt journal when an owned bridge loses stdout: %j', async (stdout) => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'task-journal')
    execaMock.mockResolvedValue({ exitCode: 0, stdout })
    const connect = vi.spyOn(Automator.prototype, 'connect')

    await expect(launch()).rejects.toThrow(stdout ? 'Failed to parse' : 'empty stdout')
    expect(createJournal).toHaveBeenCalledExactlyOnceWith('task-journal')
    expect(execaMock.mock.calls[0]?.[2]).toMatchObject({
      killDescendants: false,
      env: { WEAPP_IDE_MANAGED_PROJECT_JOURNAL: 'task-journal/children/attempt-journal' },
    })
    expect(cleanupJournal).toHaveBeenCalledExactlyOnceWith({ journalPath: 'task-journal/children/attempt-journal', scope: 'journal' })
    expect(connect).not.toHaveBeenCalled()
    expect(closeProject).not.toHaveBeenCalled()
  })

  it('waits for an aborted bridge child to finish and then cleans its late ownership before recovery', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'task-journal')
    const started = Promise.withResolvers<void>()
    const child = Promise.withResolvers<{ exitCode: number, stdout: string }>()
    const events: string[] = []
    const failure = new Error('canceled after owned receipt')
    execaMock.mockImplementation(async () => {
      events.push('owner recorded')
      started.resolve()
      const result = await child.promise
      events.push('child exited')
      return result
    })
    cleanupJournal.mockImplementationOnce(async () => {
      events.push('attempt cleaned')
    })
    const connect = vi.spyOn(Automator.prototype, 'connect')
    const lifecycle = new AutomatorLaunchLifecycle(10_000, 'bridge launch')
    const running = launchAutomatorViaCliBridge({ projectPath: 'fixture' }, 'fixture', lifecycle)
    let settled = false
    const recovery = running.catch((error) => {
      expect(error).toBe(failure)
      settled = true
      events.push('recovery allowed')
    })

    await started.promise
    lifecycle.controller.abort(failure)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(settled).toBe(false)
    expect(cleanupJournal).not.toHaveBeenCalled()
    expect(events).toEqual(['owner recorded'])

    child.resolve({
      exitCode: 0,
      stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9415', managedProject: { id: 'owned-window', journalPath: 'task-journal/children/attempt-journal' } }),
    })
    await recovery
    expect(events).toEqual(['owner recorded', 'child exited', 'attempt cleaned', 'recovery allowed'])
    expect(execaMock).toHaveBeenCalledOnce()
    expect(cleanupJournal).toHaveBeenCalledOnce()
    expect(connect).not.toHaveBeenCalled()
  })
})
