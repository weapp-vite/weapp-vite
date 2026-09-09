import type { SuiteTask } from './suiteRunner'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import {
  getSuiteTasks,
  IDE_GITHUB_ISSUES_AGGREGATE_LABELS,
  IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS,
  listE2ESuites,
} from './e2e-suite-manifest'
import { createSuiteReport } from './suiteReport'
import {
  formatSuiteArtifactsSummary,
  formatSuiteProgress,
  formatSuiteSummary,
  getTaskSpawnOptions,
  runTaskSuite,
} from './suiteRunner'

function terminateTestChild(pid: number) {
  try {
    process.kill(pid)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
}

describe('suiteRunner', () => {
  it('formats failure summary with failed tasks', () => {
    const summary = formatSuiteSummary('e2e:ci', [
      { label: 'task-a', exitCode: 0, durationMs: 1200, artifacts: [] },
      { label: 'task-b', exitCode: 2, durationMs: 3400, artifacts: [] },
    ])

    expect(summary).toContain('[e2e:ci] summary 1/2 passed')
    expect(summary).toContain('[e2e:ci] - task-b (exit 2, 3.4s)')
  })

  it('formats suite progress with a visible progress bar and task position', () => {
    expect(formatSuiteProgress('e2e:ide-full', 12, 68, 'running', 'ide/index.test.ts', 12)).toBe(
      '[e2e:ide-full] progress [====--------------------] 12/68 17.6% running 13/68 ide/index.test.ts',
    )
    expect(formatSuiteProgress('e2e:ide-full', 68, 68, 'passed', 'ide/chunk-modes.runtime.hoist.test.ts', 67, 22800)).toBe(
      '[e2e:ide-full] progress [========================] 68/68 100.0% passed 68/68 ide/chunk-modes.runtime.hoist.test.ts (22.8s)',
    )
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

  it('can stop running remaining tasks after the first failure', async () => {
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
      stopOnTaskFailure: true,
      writeReport: false,
    })

    expect(exitCode).toBe(1)
    expect(beforeEachTask).toHaveBeenCalledTimes(2)
    expect(runTask).toHaveBeenCalledTimes(2)

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

    expect(consoleLog).toHaveBeenCalledWith('[e2e:test] progress [------------------------] 0/1 0.0% still-running 1/1 slow-task (30.0s)')
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

    const leakStdoutScriptPath = path.join(tempRoot, 'leak-stdio.cjs')
    const descendantScriptPath = path.join(tempRoot, 'descendant.cjs')
    fs.writeFileSync(descendantScriptPath, `
      require('node:fs').writeFileSync(process.argv[2], String(process.pid));
      setTimeout(() => {}, 10000);
      process.send('ready');
    `)
    fs.writeFileSync(leakStdoutScriptPath, `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, [${JSON.stringify(descendantScriptPath)}, ${JSON.stringify(pidFile)}], {
        detached: true,
        windowsHide: true,
        stdio: ['ignore', 1, 2, 'ipc'],
      });
      child.once('message', () => {
        child.disconnect();
        child.unref();
        process.exit(0);
      });
    `)

    try {
      const result = await Promise.race([
        runTaskSuite('e2e:test', [
          {
            label: 'pipe-leak-task',
            command: process.execPath,
            args: [leakStdoutScriptPath],
          },
        ], {
          writeReport: false,
        }),
        new Promise<'timeout'>(resolve => setTimeout(resolve, 1000, 'timeout')),
      ])

      expect(result).toBe(0)
      expect(() => process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 0)).not.toThrow()
    }
    finally {
      if (fs.existsSync(pidFile)) {
        const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
        if (Number.isInteger(childPid) && childPid > 0) {
          terminateTestChild(childPid)
        }
      }

      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  })

  it.each(['default', 'graceful'] as const)('fails a %s task that exceeds the configured task timeout', async (termination) => {
    const previousExitCode = process.exitCode
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-timeout-'))
    const startedFile = path.join(tempRoot, 'started')
    process.exitCode = undefined

    try {
      const exitCode = await runTaskSuite('e2e:test', [
        {
          label: 'timeout-task',
          command: process.execPath,
          args: ['-e', `
            const fs = require('node:fs');
            if (${JSON.stringify(termination)} === 'graceful') {
              process.on('SIGTERM', () => process.exit(0));
            }
            fs.writeFileSync(process.argv[1], 'started');
            setInterval(() => {}, 5000);
          `, startedFile],
          env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '1000' },
        },
      ], {
        writeReport: false,
      })

      expect(exitCode).toBe(1)
      expect(fs.readFileSync(startedFile, 'utf8')).toBe('started')
      expect(consoleError).toHaveBeenCalledWith('[e2e] task timeout after 1.0s: timeout-task')
    }
    finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      consoleError.mockRestore()
      process.exitCode = previousExitCode
    }
  }, 15_000)

  it.each(['node', 'pnpm'] as const)('preserves argument boundaries through %s', async (command) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite runner arguments '))
    const scriptPath = path.join(tempRoot, 'check arguments.cjs')
    const resultPath = path.join(tempRoot, 'result.json')
    const args = ['space separated', 'parentheses (kept)', 'quote "kept"', 'ampersand & pipe | redirect >', '', 'backslash\\']
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    fs.writeFileSync(scriptPath, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))')

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: `${command}-arguments`,
        command: command === 'node' ? process.execPath : command,
        args: [...(command === 'pnpm' ? ['exec', 'node'] : []), scriptPath, resultPath, ...args],
      }], { writeReport: false })

      expect(exitCode).toBe(0)
      expect(JSON.parse(fs.readFileSync(resultPath, 'utf8'))).toEqual(args)
    }
    finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  })

  it('force kills a timed out task that ignores graceful termination', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-force-kill-'))
    const pidFile = path.join(tempRoot, 'child.pid')
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: 'force-kill-task',
        command: process.execPath,
        args: ['-e', `
          process.on('SIGTERM', () => {});
          require('node:fs').writeFileSync(process.argv[1], String(process.pid));
          setInterval(() => {}, 5000);
        `, pidFile],
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '1000' },
      }], { writeReport: false })

      const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
      expect(exitCode).toBe(1)
      await expect.poll(() => {
        try {
          process.kill(childPid, 0)
          return false
        }
        catch (error) {
          return (error as NodeJS.ErrnoException).code === 'ESRCH'
        }
      }, { timeout: 1000 }).toBe(true)
    }
    finally {
      if (fs.existsSync(pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL')
        }
        catch {
        }
      }
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  }, 15_000)

  it('cleans up a timed out process tree after its entry process exits gracefully', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-process-tree-'))
    const parentPidFile = path.join(tempRoot, 'parent.pid')
    const childPidFile = path.join(tempRoot, 'child.pid')
    const childScript = path.join(tempRoot, 'child.cjs')
    const parentScript = path.join(tempRoot, 'parent.cjs')
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    fs.writeFileSync(childScript, `
      process.on('SIGTERM', () => {});
      require('node:fs').writeFileSync(process.argv[2], String(process.pid));
      setInterval(() => {}, 5000);
    `)
    fs.writeFileSync(parentScript, `
      const fs = require('node:fs');
      const { spawn } = require('node:child_process');
      process.on('SIGTERM', () => process.exit(0));
      fs.writeFileSync(process.argv[2], String(process.pid));
      spawn(process.execPath, [process.argv[3], process.argv[4]], { stdio: 'ignore' });
    `)

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: 'process-tree-timeout',
        command: process.execPath,
        args: [parentScript, parentPidFile, childScript, childPidFile],
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '2000' },
      }], { writeReport: false })

      expect(exitCode).toBe(1)
      for (const pidFile of [parentPidFile, childPidFile]) {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'))
        await expect.poll(() => {
          try {
            process.kill(pid, 0)
            return false
          }
          catch (error) {
            return (error as NodeJS.ErrnoException).code === 'ESRCH'
          }
        }, { timeout: 2000 }).toBe(true)
      }
    }
    finally {
      for (const pidFile of [parentPidFile, childPidFile]) {
        if (fs.existsSync(pidFile)) {
          try {
            process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL')
          }
          catch {
          }
        }
      }
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  }, 20_000)

  it('cleans up a task that ignores SIGTERM when its runner exits', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-exit-cleanup-'))
    const childPidFile = path.join(tempRoot, 'child.pid')
    const runnerScript = path.join(tempRoot, 'runner.mjs')
    const suiteRunnerUrl = pathToFileURL(path.resolve(import.meta.dirname, 'suiteRunner.ts')).href
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    fs.writeFileSync(runnerScript, `
      import fs from 'node:fs';
      import { runTaskSuite } from ${JSON.stringify(suiteRunnerUrl)};
      const pidFile = process.argv[2];
      void runTaskSuite('e2e:test', [{
        label: 'ignores-termination',
        command: process.execPath,
        args: ['-e', 'process.on("SIGTERM", () => {}); require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 5000)', pidFile],
      }], { writeReport: false });
      setInterval(() => {
        if (fs.existsSync(pidFile)) process.exit(0);
      }, 10);
    `)

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: 'exiting-runner',
        command: process.execPath,
        args: ['--import', 'tsx', runnerScript, childPidFile],
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '5000' },
      }], { writeReport: false })
      expect(exitCode).toBe(0)
      const childPid = Number(fs.readFileSync(childPidFile, 'utf8'))
      await expect.poll(() => {
        try {
          process.kill(childPid, 0)
          return false
        }
        catch (error) {
          return (error as NodeJS.ErrnoException).code === 'ESRCH'
        }
      }, { timeout: 2000 }).toBe(true)
    }
    finally {
      if (fs.existsSync(childPidFile)) {
        try {
          process.kill(Number(fs.readFileSync(childPidFile, 'utf8')), 'SIGKILL')
        }
        catch {
        }
      }
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  }, 15_000)

  it('keeps ide gate smaller than ide full and includes core runtime coverage', async () => {
    const ideSmokeTasks = await getSuiteTasks('ide-smoke')
    const ideGateTasks = await getSuiteTasks('ide-gate')
    const ideFullTasks = await getSuiteTasks('ide-full')
    const ideExhaustiveTasks = await getSuiteTasks('ide-full:exhaustive')
    const ideHeadlessSmokeTasks = await getSuiteTasks('ide-headless-smoke')
    const ideHeadlessGateTasks = await getSuiteTasks('ide-headless-gate')
    const ideHeadlessFullTasks = await getSuiteTasks('ide-headless-full')
    const ideChunkModesTasks = await getSuiteTasks('ide-full:chunk-modes')
    const ideGithubIssuesTasks = await getSuiteTasks('ide-full:github-issues')
    const ideWevuJsxTasks = await getSuiteTasks('ide-full:wevu-jsx')
    const ideWevuFeaturesTasks = await getSuiteTasks('ide-full:wevu-features')
    const ideComponentLibraryTasks = await getSuiteTasks('ide-component-libraries')
    const ideComponentLibraryVisualTasks = await getSuiteTasks('ide-component-libraries:visual')
    const ideComponentLibraryVisualFullTasks = await getSuiteTasks('ide-component-libraries:visual-full')
    const ideSmokeLabels = ideSmokeTasks.map(task => task.label)
    const ideGateLabels = ideGateTasks.map(task => task.label)
    const ideFullLabels = ideFullTasks.map(task => task.label)
    const ideExhaustiveLabels = ideExhaustiveTasks.map(task => task.label)
    const ideHeadlessSmokeLabels = ideHeadlessSmokeTasks.map(task => task.label)
    const ideHeadlessGateLabels = ideHeadlessGateTasks.map(task => task.label)
    const ideHeadlessFullLabels = ideHeadlessFullTasks.map(task => task.label)
    const ideChunkModesLabels = ideChunkModesTasks.map(task => task.label)
    const ideGithubIssuesLabels = ideGithubIssuesTasks.map(task => task.label)
    const ideWevuJsxLabels = ideWevuJsxTasks.map(task => task.label)
    const ideWevuFeaturesLabels = ideWevuFeaturesTasks.map(task => task.label)
    const appLifecycleTask = ideFullTasks.find(task => task.label === 'ide/app-lifecycle.test.ts')
    const autoRoutesDefineAppJsonTask = ideFullTasks.find(task => task.label === 'ide/auto-routes-define-app-json.runtime.test.ts')
    const coreHmrTask = ideExhaustiveTasks.find(task => task.label === 'ide/wevu-runtime.core-hmr.test.ts')
    const devtoolsCliWorkflowTask = ideFullTasks.find(task => task.label === 'ide/devtools-cli-workflow.runtime.test.ts')
    const githubIssuesAggregateTasks = ideFullTasks.filter(task => IDE_GITHUB_ISSUES_AGGREGATE_LABELS.includes(task.label))
    const githubIssuesIssue621Task = ideFullTasks.find(task => task.label === 'ide/github-issues.runtime.issue621.test.ts')
    const lifecycleCompareTask = ideFullTasks.find(task => task.label === 'ide/lifecycle-compare.test.ts')
    const statefulHmrTask = ideFullTasks.find(task => task.label === 'ide/stateful-hmr.runtime.test.ts')
    const subpackageSharedStrategyComplexTask = ideFullTasks.find(task => task.label === 'ide/subpackage-shared-strategy-complex.runtime.test.ts')
    const templateDevOpenAllTask = ideFullTasks.find(task => task.label === 'ide/template-dev-open-all.runtime.test.ts')
    const templateTailwindDevOpenMultiTask = ideFullTasks.find(task => task.label === 'ide/template-tailwindcss-dev-open-multi.runtime.test.ts')
    const templateTailwindTdesignHmrTask = ideExhaustiveTasks.find(task => task.label === 'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts')
    const templateWevuTailwindTdesignHmrTask = ideFullTasks.find(task => task.label === 'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts')
    const uviewPlusCompatTask = ideComponentLibraryTasks.find(task => task.label === 'ide/uview-plus-compat.runtime.test.ts')
    const wevuRuntimeTask = ideFullTasks.find(task => task.label === 'ide/wevu-runtime.weapp.test.ts')
    const wevuJsxHmrTask = ideExhaustiveTasks.find(task => task.label === 'ide/wevu-jsx-tsx.hmr.runtime.test.ts')
    const wotUiCompatTask = ideComponentLibraryTasks.find(task => task.label === 'ide/wot-ui-compat.runtime.test.ts')
    const headlessQueryTask = ideHeadlessFullTasks.find(task => task.label === 'ide/wevu-query.runtime.test.ts')

    expect(ideSmokeTasks.length).toBeLessThan(ideGateTasks.length)
    expect(ideGateTasks.length).toBeLessThan(ideFullTasks.length)
    expect(ideFullTasks.length).toBeLessThan(ideExhaustiveTasks.length)
    expect(ideHeadlessSmokeTasks.length).toBeLessThan(ideHeadlessGateTasks.length)
    expect(ideHeadlessGateTasks.length).toBeLessThanOrEqual(ideHeadlessFullTasks.length)
    expect(ideSmokeLabels).toContain('ide/index.test.ts')
    expect(ideSmokeLabels).toContain('ide/template-weapp-vite-template.test.ts')
    expect(ideGateLabels).toContain('ide/index.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-runtime.weapp.test.ts')
    expect(ideGateLabels).toContain('ide/wevu-features.runtime.behavior.test.ts')
    expect(ideFullLabels).toContain('ide/wevu-query.runtime.test.ts')
    expect(ideHeadlessFullLabels).toContain('ide/wevu-query.runtime.test.ts')
    expect(ideWevuFeaturesLabels).toContain('ide/wevu-query.runtime.test.ts')
    expect(ideFullLabels).toContain('ide/devtools-cli-workflow.runtime.test.ts')
    expect(IDE_GITHUB_ISSUES_AGGREGATE_LABELS.every(label => ideFullLabels.includes(label))).toBe(true)
    expect(ideFullLabels).toContain('ide/template-dev-open-all.runtime.test.ts')
    expect(ideFullLabels).toContain('ide/stateful-hmr.runtime.test.ts')
    expect(ideFullLabels).not.toContain('ide/chunk-modes.runtime.duplicate.test.ts')
    expect(ideExhaustiveLabels).not.toContain('ide/runtimeErrors.test.ts')
    expect(ideExhaustiveLabels).not.toContain('ide/uview-plus-compat.runtime.test.ts')
    expect(ideExhaustiveLabels).not.toContain('ide/wot-ui-compat.runtime.test.ts')
    expect(ideComponentLibraryTasks.map(task => task.label)).toEqual([
      'ide/uview-plus-compat.runtime.test.ts',
      'ide/wot-ui-compat.runtime.test.ts',
    ])
    expect(ideComponentLibraryVisualTasks.map(task => task.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE)).toEqual(['visual', 'visual'])
    expect(ideComponentLibraryVisualFullTasks.map(task => task.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE)).toEqual(['visual-full', 'visual-full'])
    expect(headlessQueryTask?.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('headless')
    expect(devtoolsCliWorkflowTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(githubIssuesAggregateTasks.map(task => task.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS)).toEqual(['3600000'])
    expect(statefulHmrTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(subpackageSharedStrategyComplexTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('600000')
    expect(templateDevOpenAllTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('1800000')
    expect(templateTailwindDevOpenMultiTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('1200000')
    expect(templateDevOpenAllTask).toMatchObject({
      command: 'node',
      args: ['--import', 'tsx', expect.stringContaining('run-template-dev-open-suite.ts')],
      env: {
        [E2E_TARGET_FILE_ENV]: 'ide/template-dev-open-all.runtime.test.ts',
      },
    })
    expect(templateTailwindDevOpenMultiTask).toMatchObject({
      command: 'node',
      args: ['--import', 'tsx', expect.stringContaining('run-template-dev-open-suite.ts')],
      env: {
        [E2E_TARGET_FILE_ENV]: 'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
      },
    })
    expect(templateTailwindTdesignHmrTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(templateWevuTailwindTdesignHmrTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(uviewPlusCompatTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('1200000')
    expect(coreHmrTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(wevuRuntimeTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('600000')
    expect(wevuJsxHmrTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    expect(wotUiCompatTask?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('1200000')
    expect(ideHeadlessSmokeLabels).toEqual([
      'ide/index.test.ts',
      'ide/template-weapp-vite-template.test.ts',
    ])
    expect(ideHeadlessGateLabels).toContain('ide/app-lifecycle.test.ts')
    expect(ideHeadlessGateLabels).toContain('ide/wevu-runtime.weapp.test.ts')
    expect(ideHeadlessFullLabels).toContain('ide/lifecycle-compare.test.ts')
    expect(ideHeadlessFullLabels).toContain('ide/github-issues.runtime.issue705.test.ts')
    expect(ideHeadlessFullLabels).toContain('ide/wevu-jsx-tsx.runtime.test.ts')
    expect(ideWevuJsxLabels).toEqual([
      'ide/wevu-jsx-tsx.runtime.test.ts',
      'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
    ])
    expect(ideChunkModesLabels).toEqual([
      'ide/chunk-modes.runtime.duplicate.test.ts',
      'ide/chunk-modes.runtime.extras.test.ts',
      'ide/chunk-modes.runtime.hoist.test.ts',
    ])
    expect(ideExhaustiveLabels.slice(-3)).toEqual(ideChunkModesLabels)
    expect(ideExhaustiveTasks.find(task => task.env?.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE === 'direct')).toBeUndefined()
    expect(appLifecycleTask?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(autoRoutesDefineAppJsonTask?.env?.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER).toBeUndefined()
    expect(devtoolsCliWorkflowTask?.env?.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER).toBeUndefined()
    expect(githubIssuesIssue621Task?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(lifecycleCompareTask?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideExhaustiveTasks.find(task => task.label === 'ide/app-vue-hmr-alias.runtime.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideExhaustiveTasks.find(task => task.label === 'ide/automator-bridge-wrapper-hmr.runtime.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideExhaustiveTasks.find(task => task.label === 'ide/automator-concurrent-sessions.runtime.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideExhaustiveTasks.find(task => task.label === 'ide/github-issues.runtime.issue547.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideExhaustiveTasks.find(task => task.label === 'ide/github-issues.runtime.require-async.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideFullTasks.find(task => task.label === 'ide/react-runtime-spike.runtime.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(ideFullTasks.find(task => task.label === 'ide/subpackage-shared-strategy-complex.runtime.test.ts')?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(statefulHmrTask?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(templateTailwindTdesignHmrTask?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(templateWevuTailwindTdesignHmrTask?.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
    })
    expect(IDE_GITHUB_ISSUES_AGGREGATE_LABELS.every(label => ideFullLabels.includes(label))).toBe(true)
    expect(ideGithubIssuesLabels).toEqual([
      'ide/github-issues.runtime.component-instance-apis.test.ts',
      ...IDE_GITHUB_ISSUES_AGGREGATE_LABELS,
      'ide/github-issues.runtime.issue448-formdata-upload.test.ts',
      'ide/github-issues.runtime.issue547.test.ts',
      'ide/github-issues.runtime.issue558.test.ts',
      'ide/github-issues.runtime.issue615.test.ts',
      'ide/github-issues.runtime.issue621.test.ts',
      'ide/github-issues.runtime.issue779.test.ts',
      'ide/github-issues.runtime.issue826.test.ts',
      'ide/github-issues.runtime.issue642-bug7-default.test.ts',
      'ide/github-issues.runtime.issue642-bug7-performance.test.ts',
      'ide/github-issues.runtime.issue642-bug8.test.ts',
      'ide/github-issues.runtime.require-async.test.ts',
      'ide/github-issues.runtime.issue911.test.ts',
      'ide/github-issues.runtime.issue941.test.ts',
      'ide/github-issues.runtime.issue852.test.ts',
      'ide/github-issues.runtime.slot-fallback-compiler-off.test.ts',
      'ide/github-issues.runtime.subpackage-item.test.ts',
      'ide/github-issues.runtime.subpackage-user.test.ts',
    ])
    for (const sourceLabel of IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS) {
      expect(ideFullLabels).not.toContain(sourceLabel)
      expect(ideGithubIssuesLabels).not.toContain(sourceLabel)
    }
    const aggregateSource = IDE_GITHUB_ISSUES_AGGREGATE_LABELS.map(label => fs.readFileSync(
      path.resolve(import.meta.dirname, `../${label}`),
      'utf8',
    )).join('\n')
    for (const sourceLabel of IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS) {
      const importPath = `./${path.posix.basename(sourceLabel, '.ts')}`
      expect(aggregateSource).toContain(`import '${importPath}'`)
    }
    expect(aggregateSource.match(/^import '\.\/github-issues\.runtime\..+\.test'$/gm)).toHaveLength(
      IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS.length,
    )
    expect(ideGithubIssuesTasks.find(task => task.env?.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE === 'direct')).toBeUndefined()
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
    const tempParent = path.join(process.cwd(), '.tmp')
    fs.mkdirSync(tempParent, { recursive: true })
    const tempRoot = fs.mkdtempSync(path.join(tempParent, 'suite-report-'))
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
    expect(JSON.parse(json).reportDir).toBe(path.relative(process.cwd(), report.reportDir).replaceAll('\\', '/'))
  })

  it('keeps Windows task arguments out of shell command strings', () => {
    const options = getTaskSpawnOptions({
      label: 'ci/task',
      command: 'pnpm',
      args: ['vitest', 'run'],
      env: {
        E2E_PLATFORM: 'weapp',
      },
    })

    expect(options.shell).toBe(false)
    expect(options.killDescendants).toBe(true)
    expect(options.killSignal).toBe('SIGKILL')
    expect(options.env).toMatchObject({
      E2E_PLATFORM: 'weapp',
      WEAPP_VITE_E2E_REPORT_MARKERS: '1',
    })
  })

  it('defaults devtools vitest tasks to cli bridge launch mode without wrapper projects', () => {
    const previousLaunchMode = process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
    const previousPrebuild = process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
    const previousBridgeWrapper = process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER

    try {
      const options = getTaskSpawnOptions({
        label: 'ide/task.test.ts',
        command: 'pnpm',
        args: ['vitest', 'run', '-c', '/repo/e2e/vitest.e2e.devtools.config.ts'],
      })

      expect(options.env).toMatchObject({
        WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE: 'bridge',
        WEAPP_VITE_E2E_AUTOMATOR_PREBUILD: '0',
        WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '0',
        WEAPP_VITE_E2E_REPORT_MARKERS: '1',
      })
    }
    finally {
      if (previousLaunchMode == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = previousLaunchMode
      }
      if (previousPrebuild == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD = previousPrebuild
      }
      if (previousBridgeWrapper == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER = previousBridgeWrapper
      }
    }
  })

  it('preserves explicit devtools launch mode, prebuild, and wrapper overrides', () => {
    const options = getTaskSpawnOptions({
      label: 'ide/task.test.ts',
      command: 'pnpm',
      args: ['vitest', 'run', '-c', '/repo/e2e/vitest.e2e.devtools.config.ts'],
      env: {
        WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE: 'direct',
        WEAPP_VITE_E2E_AUTOMATOR_PREBUILD: '1',
        WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
      },
    })

    expect(options.env).toMatchObject({
      WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE: 'direct',
      WEAPP_VITE_E2E_AUTOMATOR_PREBUILD: '1',
      WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER: '1',
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

    await runTaskSuite('e2e:ide-companion-unit', tasks, {
      beforeEachTask: observedEnv,
      runTask: vi.fn().mockResolvedValue(0),
      writeReport: false,
    })

    const [firstTask] = observedEnv.mock.calls[0] ?? []
    const [secondTask] = observedEnv.mock.calls[1] ?? []
    const firstSentinel = firstTask?.env?.WEAPP_VITE_E2E_IDE_HMR_COMPANION_SENTINEL
    const secondSentinel = secondTask?.env?.WEAPP_VITE_E2E_IDE_HMR_COMPANION_SENTINEL

    expect(firstTask?.label).toBe('ide/first.test.ts')
    expect(firstSentinel?.replaceAll('\\', '/')).toContain('.tmp/e2e-ide-hmr-companion/e2e_ide-companion-unit.passed')
    expect(secondSentinel).toBe(firstSentinel)
    expect(secondTask).toMatchObject({
      env: {
        WEAPP_VITE_E2E_IDE_HMR_COMPANION_SENTINEL: firstSentinel,
        WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: '1',
      },
      label: 'ide/second.test.ts',
    })
  })

  it('keeps devtools login checks when the previous task was skipped by login preflight', async () => {
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

    await runTaskSuite('e2e:ide-companion-unit', tasks, {
      beforeEachTask: observedEnv,
      runTask: vi
        .fn<(task: SuiteTask) => Promise<number>>()
        .mockImplementationOnce(async (task) => {
          expect(task.devtoolsLaunchSkipped).toBeUndefined()
          task.devtoolsLaunchSkipped = true
          return 0
        })
        .mockResolvedValueOnce(0),
      writeReport: false,
    })

    const [secondTask] = observedEnv.mock.calls[1] ?? []

    expect(tasks[0]?.devtoolsLaunchSkipped).toBe(true)
    expect(secondTask?.label).toBe('ide/second.test.ts')
    expect(secondTask?.env?.WEAPP_VITE_E2E_IDE_HMR_COMPANION_SENTINEL?.replaceAll('\\', '/')).toContain('.tmp/e2e-ide-hmr-companion/e2e_ide-companion-unit.passed')
    expect(secondTask?.env?.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK).toBeUndefined()
  })
})
