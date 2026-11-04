import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSuiteTasks } from './e2e-suite-manifest'
import { createIdeSuiteCleanupHooks, orderSuiteTasks, shouldStopIdeSuiteAfterTaskFailure } from './run-e2e-suite'
import { selectSleepInhibitedE2EEntry } from './sleepInhibitedE2E/entry'
import { createSleepInhibitorCommand } from './sleepInhibitedE2E/inhibitor'
import { isDevtoolsVitestTask } from './suiteRunner'

beforeEach(() => vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools'))
afterEach(() => vi.unstubAllEnvs())

describe('run-e2e-suite ide cleanup hooks', () => {
  it('keeps the complete HMR acceptance and IDE-only entry awake through the shared wrapper', () => {
    for (const stage of ['all', 'ide']) {
      expect(selectSleepInhibitedE2EEntry(['hmr-acceptance', stage])).toEqual({ name: 'hmr-acceptance', args: [stage] })
    }
  })

  it('keeps suite arguments intact and gives caffeinate only the owner PID', () => {
    const args = ['ide-full', '--filter=github-issues']
    expect(selectSleepInhibitedE2EEntry(args)).toEqual({ name: 'suite', args })
    expect(selectSleepInhibitedE2EEntry(['devtools-matrix', '--targets=stable'])).toEqual({ name: 'devtools-matrix', args: ['--targets=stable'] })
    expect(createSleepInhibitorCommand('darwin', process.pid)).toEqual({ command: 'caffeinate', args: ['-dimsu', '-w', String(process.pid)] })
  })

  it.each(['linux', 'win32'] as const)('uses the same in-process entry without a sidecar on %s', (platform) => {
    expect(createSleepInhibitorCommand(platform)).toBeUndefined()
  })

  it('orders tasks from a rolling start point and then wraps to the beginning', () => {
    const tasks = [
      { label: 'ide/first.test.ts', command: 'pnpm', args: [], env: {} },
      { label: 'ide/second.test.ts', command: 'pnpm', args: [], env: {} },
      { label: 'ide/third.test.ts', command: 'pnpm', args: [], env: {} },
      { label: 'ide/fourth.test.ts', command: 'pnpm', args: [], env: {} },
    ]

    expect(orderSuiteTasks(tasks, { filter: '', from: '', rollFrom: '3' }).map(task => task.label)).toEqual([
      'ide/third.test.ts',
      'ide/fourth.test.ts',
      'ide/first.test.ts',
      'ide/second.test.ts',
    ])
    expect(orderSuiteTasks(tasks, { filter: '', from: '', rollFrom: 'second' }).map(task => task.label)).toEqual([
      'ide/second.test.ts',
      'ide/third.test.ts',
      'ide/fourth.test.ts',
      'ide/first.test.ts',
    ])
  })

  it('keeps from as a non-wrapping suffix selection', () => {
    const tasks = [
      { label: 'ide/first.test.ts', command: 'pnpm', args: [], env: {} },
      { label: 'ide/second.test.ts', command: 'pnpm', args: [], env: {} },
      { label: 'ide/third.test.ts', command: 'pnpm', args: [], env: {} },
    ]

    expect(orderSuiteTasks(tasks, { filter: '', from: '2', rollFrom: '' }).map(task => task.label)).toEqual([
      'ide/second.test.ts',
      'ide/third.test.ts',
    ])
  })

  it.each(['ide', 'ide-smoke', 'ide-gate', 'ide-full', 'ide-full:templates', 'hmr-regression'])(
    'enables cleanup for actual devtools tasks in %s',
    async (mode) => {
      const tasks = await getSuiteTasks(mode)
      expect(tasks.some(isDevtoolsVitestTask)).toBe(true)
      expect(createIdeSuiteCleanupHooks(tasks).beforeEachTask).toBeTypeOf('function')
      expect(shouldStopIdeSuiteAfterTaskFailure(tasks)).toBe(true)
    },
  )

  it('respects task-level and inherited provider selection before deciding to clean IDE state', () => {
    const task = { label: 'runtime', command: 'pnpm', args: ['vitest', 'run', '-c', 'vitest.e2e.devtools.config.ts'] }
    expect(isDevtoolsVitestTask(task)).toBe(true)
    expect(isDevtoolsVitestTask({ ...task, env: { WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless' } })).toBe(false)
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    expect(isDevtoolsVitestTask(task)).toBe(false)
    expect(isDevtoolsVitestTask({ ...task, env: { WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'devtools' } })).toBe(true)
  })

  it('releases owned processes before every IDE task and after the suite', async () => {
    const cleanup = vi.fn(async () => {})
    const [task] = await getSuiteTasks('ide-full')
    const hooks = createIdeSuiteCleanupHooks([task!], cleanup)

    await hooks.beforeEachTask?.(task!)
    await hooks.beforeEachTask?.(task!)
    await hooks.afterAll?.()

    expect(cleanup).toHaveBeenCalledTimes(3)
  })

  it.each(['ci', 'full', 'full-regression', 'ide-headless-smoke', 'ide-headless-gate', 'ide-headless-full', 'ide-dom-headless'])(
    'does not touch DevTools for %s',
    async (mode) => {
      const tasks = await getSuiteTasks(mode)
      expect(tasks.length).toBeGreaterThan(0)
      expect(createIdeSuiteCleanupHooks(tasks)).toEqual({})
      expect(shouldStopIdeSuiteAfterTaskFailure(tasks)).toBe(false)
    },
  )

  it('cleans only the devtools tasks within a mixed suite', async () => {
    const cleanup = vi.fn(async () => {})
    const [devtools] = await getSuiteTasks('ide-full')
    const [headless] = await getSuiteTasks('ide-dom-headless')
    const hooks = createIdeSuiteCleanupHooks([headless!, devtools!], cleanup)
    await hooks.beforeEachTask?.(headless!)
    expect(cleanup).not.toHaveBeenCalled()
    await hooks.beforeEachTask?.(devtools!)
    expect(cleanup).toHaveBeenCalledOnce()
    await hooks.afterAll?.()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
