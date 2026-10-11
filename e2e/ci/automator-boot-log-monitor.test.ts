import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDevtoolsSimulatorBootLogMonitor, DevtoolsSimulatorBootLogError } from '../utils/automatorBootLogMonitor'
import { AutomatorLaunchLifecycle } from '../utils/automatorLaunchLifecycle'
import { appendIdeReportEvent } from '../utils/ideWarningReport'

vi.mock('../utils/ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

describe('automator boot log readiness', () => {
  let rootDir: string
  let logFile: string

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-boot-monitor-'))
    logFile = path.join(rootDir, 'profile', 'WeappLog', 'logs', 'startup.log')
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.writeFileSync(logFile, '')
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_LOG_ROOT', rootDir)
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  function append(message: string, windowId = 's0', file = logFile) {
    const line = `[${new Date().toISOString()}][ERROR][rt:0,win:${windowId}] ${message}`
    fs.appendFileSync(file, `${line}\n`)
    return line
  }

  function appendFailure() {
    return append('[appservice] simulator launch catch error Error: simulator launch failed')
  }

  function finish(monitor: ReturnType<typeof createDevtoolsSimulatorBootLogMonitor>, timeoutMs = 1_000) {
    const lifecycle = new AutomatorLaunchLifecycle(timeoutMs, 'test launch')
    return lifecycle.run(scope => monitor.finishStartup(scope)).catch((error) => {
      throw monitor.normalizeError(error)
    })
  }

  it('keeps the first diagnostic and waits for later readiness in the same window', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const failure = appendFailure()
    expect(() => monitor.assertClean('connect', true)).not.toThrow()
    let completed = false
    const running = finish(monitor).then(() => {
      completed = true
    })
    await vi.advanceTimersByTimeAsync(499)
    expect(completed).toBe(false)

    const ready = append('[devtools] webview page ready')
    await vi.advanceTimersByTimeAsync(1)
    await running
    expect(completed).toBe(true)
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event.text)).toEqual([
      `connect: state=pending window=s0 first-error=${failure}`,
      `startup webview page ready: state=recovered window=s0 first-error=${failure} ready=${ready}`,
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains both diagnostic events when readiness arrives before the first scan', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const failure = appendFailure()
    const ready = append('[devtools] webview page ready')
    await finish(monitor)

    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event.text)).toEqual([
      `startup webview page ready: state=pending window=s0 first-error=${failure}`,
      `startup webview page ready: state=recovered window=s0 first-error=${failure} ready=${ready}`,
    ])
  })

  it.each(['launch success', 'different window', 'different log', 'earlier ready'])('does not accept %s as recovery', async (evidence) => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    if (evidence === 'earlier ready') {
      append('[devtools] webview page ready')
    }
    const failure = appendFailure()
    monitor.assertClean('connect', true)
    if (evidence === 'launch success') {
      append('[appservice] simulator launch success')
    }
    if (evidence === 'different window') {
      append('[devtools] webview page ready', 's1')
    }
    if (evidence === 'different log') {
      append('[devtools] webview page ready', 's0', path.join(path.dirname(logFile), 'other.log'))
    }

    const assertion = expect(finish(monitor)).rejects.toMatchObject({
      name: 'WechatIdeSimulatorBootLogError',
      firstIssue: { line: failure, state: 'pending' },
      cause: { message: 'Timeout in test launch after 1000ms' },
    })
    await vi.advanceTimersByTimeAsync(1_000)
    await assertion
    expect(appendIdeReportEvent).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves pending evidence when a log is truncated instead of treating disappearance as recovery', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const failure = appendFailure()
    monitor.assertClean('connect', true)
    fs.writeFileSync(logFile, '[INFO] rotated log\n')

    const assertion = expect(finish(monitor)).rejects.toThrow(failure)
    await vi.advanceTimersByTimeAsync(1_000)
    await assertion
  })

  it('does not use page readiness after the deadline to erase the first error', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const first = appendFailure()
    monitor.assertClean('connect', true)
    const lifecycle = new AutomatorLaunchLifecycle(1_000, 'test launch')
    const stopped = lifecycle.run(scope => monitor.finishStartup(scope)).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1_000)
    const timeout = await stopped
    append('[devtools] webview page ready')
    expect(monitor.normalizeError(timeout)).toMatchObject({
      firstIssue: { line: first, state: 'pending' },
      cause: timeout,
    })
    expect(appendIdeReportEvent).toHaveBeenCalledTimes(1)
  })

  it.each([
    'TypeError: Cannot read properties of undefined (reading \'MaxSubPackageLimit\')',
    'TypeError: Cannot read property \'subPackages\' of undefined',
    'Error: simulator launch failed: invalid configuration',
  ])('fails immediately on a concrete initialization error despite later readiness: %s', (error) => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const failure = append(`[appservice] simulator launch catch error ${error}`)
    append('[devtools] webview page ready')
    expect(() => monitor.assertClean('connect', true)).toThrow(failure)
    expect(() => monitor.assertClean('connect')).toThrow(DevtoolsSimulatorBootLogError)
  })

  it('fails closed for a generic error without a window identity', () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    fs.appendFileSync(logFile, '[ERROR] simulator launch catch error Error: simulator launch failed\n')
    append('[devtools] webview page ready')
    expect(() => monitor.assertClean('connect', true)).toThrow('simulator launch failed')
  })

  it('preserves the first pending error when a later concrete initialization failure stops startup', () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    const first = appendFailure()
    monitor.assertClean('connect', true)
    const fatal = append('TypeError: Cannot read properties of undefined (reading \'MaxSubPackageLimit\')')
    append('[devtools] webview page ready')
    expect(() => monitor.assertClean('connect', true)).toThrow(`${first}; blocking error: ${fatal}`)
  })

  it('does not defer new generic failures after startup has completed', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    await finish(monitor)
    const failure = appendFailure()
    expect(() => monitor.assertClean('reLaunch', true)).toThrow(failure)
  })

  it('keeps the original operation error when all pending evidence has recovered', async () => {
    const monitor = createDevtoolsSimulatorBootLogMonitor('fixture')
    appendFailure()
    append('[devtools] webview page ready')
    await finish(monitor)
    const failure = new Error('unrelated protocol failure')
    expect(monitor.normalizeError(failure)).toBe(failure)
  })
})
