import type { SuiteTask } from './suiteRunner'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import { getSuiteTasks, listE2ESuites } from './e2e-suite-manifest'
import { createSuiteReport } from './suiteReport'
import {
  formatSuiteArtifactsSummary,
  formatSuiteSummary,
  getTaskSpawnOptions,
  runTaskSuite,
} from './suiteRunner'

describe('suiteRunner', () => {
  it('formats failure summary with failed tasks', () => {
    const summary = formatSuiteSummary('e2e:ci', [
      { label: 'task-a', exitCode: 0, durationMs: 1200, artifacts: [] },
      { label: 'task-b', exitCode: 2, durationMs: 3400, artifacts: [] },
    ])

    expect(summary).toContain('[e2e:ci] summary 1/2 passed')
    expect(summary).toContain('[e2e:ci] - task-b (exit 2, 3.4s)')
  })

  it('formats artifact summary without duplicate report paths', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-artifacts-'))
    const reportPath = path.join(tempRoot, 'docs/reports/e2e-ide/index.md')
    const summary = formatSuiteArtifactsSummary('e2e:ide', [
      { kind: 'ide-warning-report', indexPath: reportPath },
      { kind: 'ide-warning-report', indexPath: reportPath },
      { kind: 'suite-report', indexPath: path.join(tempRoot, 'docs/reports/e2e-suite/index.md') },
    ])

    expect(summary).toContain('[e2e:ide] reports:')
    expect(summary).toContain('ide-warning-report')
    expect(summary.match(/ide-warning-report/g)).toHaveLength(1)
    expect(summary).toContain('suite-report')
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
      writeReport: false,
    })

    expect(exitCode).toBe(1)
    expect(beforeEachTask).toHaveBeenCalledTimes(3)
    expect(runTask).toHaveBeenCalledTimes(3)

    process.exitCode = previousExitCode
  })

  it('can continue with failing tasks without setting process exit code', async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    const exitCode = await runTaskSuite('e2e:test', [
      { label: 'first', command: 'pnpm', args: ['vitest'] },
      { label: 'second', command: 'pnpm', args: ['vitest'] },
    ], {
      failOnTaskFailure: false,
      runTask: vi
        .fn<(task: SuiteTask) => Promise<number>>()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1),
      writeReport: false,
    })

    expect(exitCode).toBe(1)
    expect(process.exitCode).toBeUndefined()

    process.exitCode = previousExitCode
  })

  it('prints heartbeat logs while a task is still running', async () => {
    vi.useFakeTimers()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    let resolveTask!: (value: number) => void
    const pendingTask = new Promise<number>((resolve) => {
      resolveTask = resolve
    })

    const runPromise = runTaskSuite('e2e:test', [
      { label: 'slow-task', command: 'pnpm', args: ['vitest'] },
    ], {
      runTask: vi.fn().mockReturnValue(pendingTask),
      writeReport: false,
    })

    await vi.advanceTimersByTimeAsync(30_000)

    expect(consoleLog).toHaveBeenCalledWith('[e2e:test] still running slow-task (30.0s)')

    resolveTask(0)
    await runPromise

    process.exitCode = previousExitCode
    consoleLog.mockRestore()
    vi.useRealTimers()
  })

  it('does not wait forever when descendant processes keep piped stdio open after exit', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-child-exit-'))
    const pidFile = path.join(tempRoot, 'child.pid')
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    const leakStdoutScript = `
      const fs = require('node:fs');
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], {
        stdio: ['ignore', 1, 2],
      });
      fs.writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
      process.exit(0);
    `

    try {
      const result = await Promise.race([
        runTaskSuite('e2e:test', [
          {
            label: 'pipe-leak-task',
            command: process.execPath,
            args: ['-e', leakStdoutScript],
          },
        ], {
          writeReport: false,
        }),
        new Promise<'timeout'>(resolve => setTimeout(resolve, 1000, 'timeout')),
      ])

      expect(result).toBe(0)
    }
    finally {
      if (fs.existsSync(pidFile)) {
        const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
        if (Number.isInteger(childPid) && childPid > 0) {
          try {
            process.kill(childPid)
          }
          catch {
          }
        }
      }

      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  })

  it('keeps ide gate smaller than ide full and includes core runtime coverage', async () => {
    const ideSmokeTasks = await getSuiteTasks('ide-smoke')
    const ideGateTasks = await getSuiteTasks('ide-gate')
    const ideFullTasks = await getSuiteTasks('ide-full')
    const ideHeadlessSmokeTasks = await getSuiteTasks('ide-headless-smoke')
    const ideHeadlessGateTasks = await getSuiteTasks('ide-headless-gate')
    const ideHeadlessFullTasks = await getSuiteTasks('ide-headless-full')
    const ideChunkModesTasks = await getSuiteTasks('ide-full:chunk-modes')
    const ideGithubIssuesTasks = await getSuiteTasks('ide-full:github-issues')
    const ideSmokeLabels = ideSmokeTasks.map(task => task.label)
    const ideGateLabels = ideGateTasks.map(task => task.label)
    const ideFullLabels = ideFullTasks.map(task => task.label)
    const ideHeadlessSmokeLabels = ideHeadlessSmokeTasks.map(task => task.label)
    const ideHeadlessGateLabels = ideHeadlessGateTasks.map(task => task.label)
    const ideHeadlessFullLabels = ideHeadlessFullTasks.map(task => task.label)
    const ideChunkModesLabels = ideChunkModesTasks.map(task => task.label)
    const ideGithubIssuesLabels = ideGithubIssuesTasks.map(task => task.label)

    expect(ideSmokeTasks.length).toBeLessThan(ideGateTasks.length)
    expect(ideGateTasks.length).toBeLessThan(ideFullTasks.length)
    expect(ideHeadlessSmokeTasks.length).toBeLessThan(ideHeadlessGateTasks.length)
    expect(ideHeadlessGateTasks.length).toBeLessThanOrEqual(ideHeadlessFullTasks.length)
    expect(ideSmokeLabels).toContain('ide/index.test.ts')
    expect(ideSmokeLabels).toContain('ide/template-weapp-vite-template.test.ts')
    expect(ideGateLabels).toContain('ide/index.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-runtime.weapp.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-features.runtime.behavior.test.ts')
    expect(ideHeadlessSmokeLabels).toEqual([
      'ide/index.test.ts',
      'ide/template-weapp-vite-template.test.ts',
    ])
    expect(ideHeadlessGateLabels).toContain('ide/app-lifecycle.test.ts')
    expect(ideHeadlessGateLabels).toContain('ide/wevu-runtime.weapp.test.ts')
    expect(ideHeadlessFullLabels).toContain('ide/lifecycle-compare.test.ts')
    expect(ideChunkModesLabels).toEqual([
      'ide/chunk-modes.runtime.duplicate.test.ts',
      'ide/chunk-modes.runtime.extras.test.ts',
      'ide/chunk-modes.runtime.hoist.test.ts',
    ])
    expect(ideFullLabels.slice(-3)).toEqual(ideChunkModesLabels)
    expect(ideGithubIssuesLabels).toContain('ide/github-issues.runtime.issue289.test.ts')
    expect(ideGithubIssuesLabels).toContain('ide/github-issues.runtime.lifecycle.test.ts')
    expect(ideGithubIssuesTasks.length).toBe(4)
  })

  it('uses env-based target file selection for suite vitest tasks', async () => {
    const [firstIdeSmokeTask] = await getSuiteTasks('ide-smoke')
    const [firstHeadlessSmokeTask] = await getSuiteTasks('ide-headless-smoke')

    expect(firstIdeSmokeTask).toMatchObject({
      label: 'ide/index.test.ts',
      command: 'pnpm',
      args: ['vitest', 'run', '-c', expect.stringContaining('vitest.e2e.devtools.config.ts')],
      env: {
        [E2E_TARGET_FILE_ENV]: 'ide/index.test.ts',
      },
    })
    expect(firstIdeSmokeTask?.args).toHaveLength(4)
    expect(firstHeadlessSmokeTask).toMatchObject({
      label: 'ide/index.test.ts',
      command: 'pnpm',
      args: ['vitest', 'run', '-c', expect.stringContaining('vitest.e2e.headless.config.ts')],
      env: {
        [E2E_TARGET_FILE_ENV]: 'ide/index.test.ts',
        WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
      },
    })
  })

  it('lists suite metadata for layered ide execution', async () => {
    const suites = await listE2ESuites()
    const ideSmoke = suites.find(suite => suite.name === 'ide-smoke')
    const ideGate = suites.find(suite => suite.name === 'ide-gate')
    const ideFull = suites.find(suite => suite.name === 'ide-full')
    const ideHeadlessSmoke = suites.find(suite => suite.name === 'ide-headless-smoke')
    const ideHeadlessGate = suites.find(suite => suite.name === 'ide-headless-gate')
    const ideHeadlessFull = suites.find(suite => suite.name === 'ide-headless-full')

    expect(ideSmoke).toBeDefined()
    expect(ideGate).toBeDefined()
    expect(ideFull).toBeDefined()
    expect(ideHeadlessSmoke).toBeDefined()
    expect(ideHeadlessGate).toBeDefined()
    expect(ideHeadlessFull).toBeDefined()
    expect(ideSmoke!.taskCount).toBeGreaterThan(0)
    expect(ideSmoke!.taskCount).toBeLessThan(ideGate!.taskCount)
    expect(ideGate!.taskCount).toBeLessThan(ideFull!.taskCount)
    expect(ideHeadlessSmoke!.taskCount).toBeLessThan(ideHeadlessGate!.taskCount)
    expect(ideHeadlessGate!.taskCount).toBeLessThanOrEqual(ideHeadlessFull!.taskCount)
    expect(ideSmoke!.labels).toContain('ide/index.test.ts')
    expect(ideHeadlessSmoke!.labels).toContain('ide/template-weapp-vite-template.test.ts')
  })

  it('writes a suite report that preserves child report links across tasks', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-report-'))
    const reportsRoot = path.join(tempRoot, 'docs/reports')
    const report = createSuiteReport([
      {
        label: 'task-a',
        exitCode: 1,
        durationMs: 1000,
        artifacts: [
          {
            kind: 'ide-warning-report',
            indexPath: path.resolve(tempRoot, 'docs/reports/child-a/index.md'),
          },
        ],
      },
      {
        label: 'task-b',
        exitCode: 0,
        durationMs: 2400,
        artifacts: [
          {
            kind: 'suite-report',
            indexPath: path.resolve(tempRoot, 'docs/reports/child-b/index.md'),
          },
        ],
      },
    ], 'e2e:ide-full:templates', new Date('2026-03-25T13:30:00.000Z'), reportsRoot)

    const markdown = fs.readFileSync(path.join(report.reportDir, report.markdownFile), 'utf8')
    const json = fs.readFileSync(path.join(report.reportDir, report.jsonFile), 'utf8')

    expect(markdown).toContain('# e2e:ide-full:templates 汇总报告')
    expect(markdown).toContain('child-a/index.md')
    expect(markdown).toContain('child-b/index.md')
    expect(json).toContain('"failedCount": 1')
    expect(json).toContain('"artifactCount": 2')
  })

  it('enables shell mode for Windows task commands so pnpm resolves correctly', () => {
    const options = getTaskSpawnOptions({
      label: 'ci/task',
      command: 'pnpm',
      args: ['vitest', 'run'],
      env: {
        E2E_PLATFORM: 'weapp',
      },
    }, 'win32')

    expect(options.shell).toBe(true)
    expect(options.env).toMatchObject({
      E2E_PLATFORM: 'weapp',
      WEAPP_VITE_E2E_REPORT_MARKERS: '1',
    })
  })

  it('skips repeated devtools login checks after the first successful devtools task', async () => {
    const tasks: SuiteTask[] = [
      {
        label: 'ide/first.test.ts',
        command: 'pnpm',
        args: ['vitest', 'run', '-c', '/repo/e2e/vitest.e2e.devtools.config.ts', '/repo/e2e/ide/first.test.ts'],
      },
      {
        label: 'ide/second.test.ts',
        command: 'pnpm',
        args: ['vitest', 'run', '-c', '/repo/e2e/vitest.e2e.devtools.config.ts', '/repo/e2e/ide/second.test.ts'],
      },
    ]
    const observedEnv = vi.fn<(task: SuiteTask) => void>()

    await runTaskSuite('e2e:ide-full', tasks, {
      beforeEachTask: observedEnv,
      runTask: vi.fn().mockResolvedValue(0),
      writeReport: false,
    })

    const [firstTask] = observedEnv.mock.calls[0] ?? []
    const [secondTask] = observedEnv.mock.calls[1] ?? []

    expect(firstTask?.label).toBe('ide/first.test.ts')
    expect(firstTask?.env).toBeUndefined()
    expect(secondTask).toMatchObject({
      env: {
        WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: '1',
      },
      label: 'ide/second.test.ts',
    })
  })
})
