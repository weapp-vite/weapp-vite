import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSuiteTasks } from './e2e-suite-manifest'
import { runE2ESuiteCli } from './run-e2e-suite'
import { runTaskSuite } from './suiteRunner'

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
  it.each(['ide-full', 'ide-full:exhaustive'])('passes default strict policy for %s to the runner', async (mode) => {
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
})
