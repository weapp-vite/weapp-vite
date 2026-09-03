import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createIdeSuiteCleanupHooks, orderSuiteTasks, shouldCleanupIdeBeforeEachTask, shouldStopIdeSuiteAfterTaskFailure } from './run-e2e-suite'
import { createSleepInhibitedE2ECommand } from './run-sleep-inhibited-e2e-suite'

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

  it('enables cleanup hooks for devtools-backed ide suites', () => {
    expect(shouldCleanupIdeBeforeEachTask('ide')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-smoke')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-gate')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-full')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-full:templates')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('hmr-regression')).toBe(true)
  })

  it('cleans processes and compile cache before every IDE task, then processes after the suite', async () => {
    const cleanup = vi.fn(async () => {})
    const cleanCompileCache = vi.fn(async () => {})
    const hooks = createIdeSuiteCleanupHooks('ide-full', cleanup, cleanCompileCache)

    await hooks.beforeEachTask?.()
    await hooks.beforeEachTask?.()
    await hooks.afterAll?.()

    expect(cleanup).toHaveBeenCalledTimes(3)
    expect(cleanCompileCache).toHaveBeenCalledTimes(2)
  })

  it('skips cleanup hooks for non-devtools or headless suites', () => {
    expect(shouldCleanupIdeBeforeEachTask('ci')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('full')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('full-regression')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-smoke')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-gate')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-full')).toBe(false)
  })

  it('stops devtools-backed ide suites after the first failed task', () => {
    expect(shouldStopIdeSuiteAfterTaskFailure('ide-full')).toBe(true)
    expect(shouldStopIdeSuiteAfterTaskFailure('ide-full:github-issues')).toBe(true)
    expect(shouldStopIdeSuiteAfterTaskFailure('hmr-regression')).toBe(true)
    expect(shouldStopIdeSuiteAfterTaskFailure('ide-headless-full')).toBe(false)
    expect(shouldStopIdeSuiteAfterTaskFailure('ci')).toBe(false)
  })
})
