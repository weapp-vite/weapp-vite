import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSuiteTasks } from './e2e-suite-manifest'
import { runE2ESuiteCli } from './run-e2e-suite'
import { getTaskSpawnOptions, runTaskSuite } from './suiteRunner'

vi.mock('./suiteRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./suiteRunner')>()
  return {
    ...actual,
    isDevtoolsVitestTask: vi.fn(() => false),
    runTaskSuite: vi.fn(async () => 0),
  }
})

beforeEach(() => {
  for (const name of [
    'WEAPP_VITE_E2E_DOM_ACCEPTANCE',
    'WEAPP_VITE_E2E_EXCLUDE_PROJECTS',
    'WEAPP_VITE_E2E_TASK_FILTER',
    'WEAPP_VITE_E2E_TASK_FROM',
    'WEAPP_VITE_E2E_TASK_ROLL_FROM',
    'WEAPP_VITE_E2E_SHARD_INDEX',
    'WEAPP_VITE_E2E_SHARD_TOTAL',
    'WEAPP_VITE_E2E_TEMPLATE',
  ]) {
    vi.stubEnv(name, undefined)
  }
  vi.mocked(runTaskSuite).mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  process.exitCode = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('IDE full CLI acceptance policy', () => {
  it('passes the launch callback through the formal exhaustive entry without narrowing its strict plan', async () => {
    const beforeTaskLaunch = vi.fn()
    const planned = await getSuiteTasks('ide-full:exhaustive')
    await runE2ESuiteCli(['ide-full:exhaustive'], { beforeTaskLaunch })
    expect(runTaskSuite).toHaveBeenCalledOnce()
    const [name, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(name).toBe('e2e:ide-full:exhaustive')
    expect(options?.beforeTaskLaunch).toBe(beforeTaskLaunch)
    expect(beforeTaskLaunch).not.toHaveBeenCalled()
    expect(tasks.map(task => task.label)).toEqual(planned.map(task => task.label))
    expect(options?.reportContext).toMatchObject({ strict: true, partial: false, plannedTasks: tasks })
  })

  it('preserves explicitly excluded tasks as out-of-scope report entries', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_EXCLUDE_PROJECTS', 'uview-plus-compat,wot-ui-compat')
    await runE2ESuiteCli(['ide-component-libraries'])
    const [, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(tasks).toHaveLength(2)
    expect(tasks.every(task => task.outOfScopeReason?.includes('WEAPP_VITE_E2E_EXCLUDE_PROJECTS'))).toBe(true)
    expect(options?.reportContext?.plannedTasks).toEqual(tasks)
    const nestedTask = { label: 'nested-web', command: 'node', args: [] }
    expect(getTaskSpawnOptions(nestedTask).env?.WEAPP_VITE_E2E_EXCLUDE_PROJECTS)
      .toBe('uview-plus-compat,wot-ui-compat')
  })

  it.each(['ide-full', 'ide-full:exhaustive', 'ide-dom-headless', 'ide-hmr', 'ide-hmr-headless'])('passes default strict policy for %s to the runner', async (mode) => {
    await runE2ESuiteCli([mode])
    expect(runTaskSuite).toHaveBeenCalledOnce()
    const [, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(options?.reportContext).toMatchObject({ strict: true, partial: false })
    expect(options?.reportContext?.plannedTasks).toEqual(tasks)
  })

  it.each([
    { args: ['--filter=app-lifecycle'], template: undefined },
    { args: ['--from=2'], template: undefined },
    { args: ['--shard-index=1', '--shard-total=2'], template: undefined },
    { args: [], template: 'weapp-vite-template' },
  ])('retains the full plan and marks selections partial: $args / $template', async ({ args, template }) => {
    const planned = await getSuiteTasks('ide-full')
    vi.stubEnv('WEAPP_VITE_E2E_TEMPLATE', template)
    await runE2ESuiteCli(['ide-full', ...args])
    const [, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(options?.reportContext).toMatchObject({ strict: true, partial: true })
    expect(options?.reportContext?.plannedTasks.map(task => task.label)).toEqual(planned.map(task => task.label))
    if (args.length) {
      expect(tasks.length).toBeLessThan(planned.length)
    }
  })

  it('keeps a rolling start complete because it only reorders tasks', async () => {
    const planned = await getSuiteTasks('ide-full')
    await runE2ESuiteCli(['ide-full', '--roll-from=2'])
    const [, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(options?.reportContext).toMatchObject({ strict: true, partial: false })
    expect(options?.reportContext?.plannedTasks.map(task => task.label)).toEqual(planned.map(task => task.label))
    expect(tasks.map(task => task.label)).toEqual([...planned.slice(1), planned[0]!].map(task => task.label))
  })

  it('does not let allow-failures turn off strict evidence validation', async () => {
    await runE2ESuiteCli(['ide-full', '--allow-failures'])
    const [, , options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(options).toMatchObject({
      failOnTaskFailure: false,
      stopOnTaskFailure: false,
      reportContext: { strict: true, partial: false },
    })
  })

  it.each(['equals', 'separate'] as const)('dispatches only the selected runtime task with %s filter syntax', async (format) => {
    const label = 'ide/native-property-delivery.runtime.test.ts'
    const args = format === 'equals' ? [`--filter=${label}`] : ['--filter', label]
    await runE2ESuiteCli(['ide-full', ...args])
    expect(runTaskSuite).toHaveBeenCalledOnce()
    const [, tasks, options] = vi.mocked(runTaskSuite).mock.calls[0]!
    expect(tasks.map(task => task.label)).toEqual([label])
    expect(options?.reportContext).toMatchObject({ strict: true, partial: true })
    expect(options?.reportContext?.plannedTasks.length).toBeGreaterThan(1)
  })

  it.each([
    ['--fitler=runtime'],
    ['--filter'],
    ['--filter='],
    ['--filter', '--allow-failures'],
    ['--topology'],
    ['--plan='],
    ['--shard-index'],
  ])('does not dispatch tasks for malformed options: %j', async (...args) => {
    vi.stubEnv('WEAPP_VITE_E2E_TASK_FILTER', 'native-property')
    await expect(runE2ESuiteCli(['ide-full', ...args])).rejects.toThrow(/Unknown e2e suite option|requires a value/)
    expect(runTaskSuite).not.toHaveBeenCalled()
  })

  it('does not dispatch tasks when the filter matches no runtime task', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await runE2ESuiteCli(['ide-full', '--filter', 'nonexistent-runtime-fixture'])
    expect(process.exitCode).toBe(1)
    expect(runTaskSuite).not.toHaveBeenCalled()
  })

  it('applies an explicit DevTools selection only while dispatching the selected task', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', 'nightly')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_CHANNEL', 'rc')
    vi.mocked(runTaskSuite).mockImplementationOnce(async () => {
      expect(process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL).toBe('stable')
      expect(process.env.WEAPP_IDE_DEVTOOLS_CHANNEL).toBeUndefined()
      expect(process.env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST).toBe('0')
      expect(process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST).toBe('0')
      return 0
    })
    await runE2ESuiteCli(['ide-full', '--filter', 'native-property-delivery.runtime.test.ts', '--devtools-channel', 'stable', '--require-official-latest', 'false'])
    expect(runTaskSuite).toHaveBeenCalledOnce()
    expect(process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL).toBe('nightly')
    expect(process.env.WEAPP_IDE_DEVTOOLS_CHANNEL).toBe('rc')
  })
})
