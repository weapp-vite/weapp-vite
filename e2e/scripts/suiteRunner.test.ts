import type { SuiteTask } from './suiteRunner'
import { describe, expect, it, vi } from 'vitest'
import { getSuiteTasks, listE2ESuites } from './e2e-suite-manifest'
import { formatSuiteSummary, runTaskSuite } from './suiteRunner'

describe('suiteRunner', () => {
  it('formats failure summary with failed tasks', () => {
    const summary = formatSuiteSummary('e2e:ci', [
      { label: 'task-a', exitCode: 0, durationMs: 1200 },
      { label: 'task-b', exitCode: 2, durationMs: 3400 },
    ])

    expect(summary).toContain('[e2e:ci] summary 1/2 passed')
    expect(summary).toContain('[e2e:ci] - task-b (exit 2, 3.4s)')
  })

  it('continues running tasks after a failure and returns a failing exit code', async () => {
    const previousExitCode = process.exitCode
    const tasks: SuiteTask[] = [
      { label: 'first', command: 'pnpm', args: ['vitest'] },
      { label: 'second', command: 'pnpm', args: ['vitest'] },
      { label: 'third', command: 'pnpm', args: ['vitest'] },
    ]
    const beforeEachTask = vi.fn()
    const runTask = vi
      .fn<(task: SuiteTask) => Promise<number>>()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)

    const exitCode = await runTaskSuite('e2e:test', tasks, {
      beforeEachTask,
      runTask,
    })

    expect(exitCode).toBe(1)
    expect(beforeEachTask).toHaveBeenCalledTimes(3)
    expect(runTask).toHaveBeenCalledTimes(3)

    process.exitCode = previousExitCode
  })

  it('keeps ide gate smaller than ide full and includes core runtime coverage', () => {
    const ideSmokeTasks = getSuiteTasks('ide-smoke')
    const ideGateTasks = getSuiteTasks('ide-gate')
    const ideFullTasks = getSuiteTasks('ide-full')
    const ideGithubIssuesTasks = getSuiteTasks('ide-full:github-issues')
    const ideSmokeLabels = ideSmokeTasks.map(task => task.label)
    const ideGateLabels = ideGateTasks.map(task => task.label)
    const ideGithubIssuesLabels = ideGithubIssuesTasks.map(task => task.label)

    expect(ideSmokeTasks.length).toBeLessThan(ideGateTasks.length)
    expect(ideGateTasks.length).toBeLessThan(ideFullTasks.length)
    expect(ideSmokeLabels).toContain('ide/index.test.ts')
    expect(ideSmokeLabels).toContain('ide/template-weapp-vite-template.test.ts')
    expect(ideGateLabels).toContain('ide/index.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-runtime.weapp.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-features.runtime.behavior.test.ts')
    expect(ideGithubIssuesLabels).toContain('ide/github-issues.runtime.issue289.test.ts')
    expect(ideGithubIssuesLabels).toContain('ide/github-issues.runtime.lifecycle.test.ts')
    expect(ideGithubIssuesTasks.length).toBe(4)
  })

  it('lists suite metadata for layered ide execution', () => {
    const suites = listE2ESuites()
    const ideSmoke = suites.find(suite => suite.name === 'ide-smoke')
    const ideGate = suites.find(suite => suite.name === 'ide-gate')
    const ideFull = suites.find(suite => suite.name === 'ide-full')

    expect(ideSmoke).toBeDefined()
    expect(ideGate).toBeDefined()
    expect(ideFull).toBeDefined()
    expect(ideSmoke!.taskCount).toBeGreaterThan(0)
    expect(ideSmoke!.taskCount).toBeLessThan(ideGate!.taskCount)
    expect(ideGate!.taskCount).toBeLessThan(ideFull!.taskCount)
    expect(ideSmoke!.labels).toContain('ide/index.test.ts')
  })
})
