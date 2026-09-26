import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSuiteTasks } from './e2e-suite-manifest'
import { createIdeSuiteCleanupHooks, orderSuiteTasks, shouldStopIdeSuiteAfterTaskFailure } from './run-e2e-suite'
import { createSleepInhibitedE2ECommand } from './run-sleep-inhibited-e2e-suite'
import { isDevtoolsVitestTask } from './suiteRunner'

beforeEach(() => vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools'))
afterEach(() => vi.unstubAllEnvs())

describe('run-e2e-suite ide cleanup hooks', () => {
  it('wraps IDE full suites with caffeinate on macOS', () => {
    const invocation = createSleepInhibitedE2ECommand(
      ['ide-full', '--filter=github-issues'],
      'darwin',
      '/runtime/node',
    )

    expect(invocation.command).toBe('caffeinate')
    expect(invocation.args.slice(0, 4)).toEqual(['-dimsu', '--', '/runtime/node', '--import'])
    expect(invocation.args.at(-2)).toBe('ide-full')
    expect(invocation.args.at(-1)).toBe('--filter=github-issues')
    expect(path.basename(invocation.args[5]!)).toBe('run-e2e-suite.ts')
  })

  it.each(['linux', 'win32'] as const)('runs Node directly on %s', (platform) => {
    const invocation = createSleepInhibitedE2ECommand(['ide-full'], platform, 'node-runtime')

    expect(invocation.command).toBe('node-runtime')
    expect(invocation.args.slice(0, 2)).toEqual(['--import', 'tsx'])
    expect(path.basename(invocation.args[2]!)).toBe('run-e2e-suite.ts')
    expect(invocation.args.at(-1)).toBe('ide-full')
  })

  it('orders tasks from a rolling start point and then wraps to the beginning', () => {
    const tasks = [
      { label: 'ide/first.test.ts', command: 'pnpm', args: [] },
      { label: 'ide/second.test.ts', command: 'pnpm', args: [] },
      { label: 'ide/third.test.ts', command: 'pnpm', args: [] },
      { label: 'ide/fourth.test.ts', command: 'pnpm', args: [] },
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
      { label: 'ide/first.test.ts', command: 'pnpm', args: [] },
      { label: 'ide/second.test.ts', command: 'pnpm', args: [] },
      { label: 'ide/third.test.ts', command: 'pnpm', args: [] },
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

  it('cleans processes and compile cache before every IDE task, then processes after the suite', async () => {
    const cleanup = vi.fn(async () => {})
    const cleanCompileCache = vi.fn(async () => {})
    const [task] = await getSuiteTasks('ide-full')
    const hooks = createIdeSuiteCleanupHooks([task!], cleanup, cleanCompileCache)

    await hooks.beforeEachTask?.(task!)
    await hooks.beforeEachTask?.(task!)
    await hooks.afterAll?.()

    expect(cleanup).toHaveBeenCalledTimes(3)
    expect(cleanCompileCache).toHaveBeenCalledTimes(2)
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
    const cleanCompileCache = vi.fn(async () => {})
    const [devtools] = await getSuiteTasks('ide-full')
    const [headless] = await getSuiteTasks('ide-dom-headless')
    const hooks = createIdeSuiteCleanupHooks([headless!, devtools!], cleanup, cleanCompileCache)
    await hooks.beforeEachTask?.(headless!)
    expect(cleanup).not.toHaveBeenCalled()
    expect(cleanCompileCache).not.toHaveBeenCalled()
    await hooks.beforeEachTask?.(devtools!)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(cleanCompileCache).toHaveBeenCalledOnce()
    await hooks.afterAll?.()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
